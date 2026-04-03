import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { parseKoreanBankCSV } from '@/lib/csv/parser'
import { generateTxHash } from '@/lib/utils/hash'

function getRateLimiter() {
  return new Ratelimit({
    redis: new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    }),
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    prefix: 'taxflow:upload',
  })
}

const MAX_FILE_SIZE = 10 * 1024 * 1024
const STORAGE_BUCKET = 'csv-uploads'
const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.xls']
const ALLOWED_MIME_TYPES = [
  'text/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

export async function POST(request: NextRequest) {
  // ── 1. Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  }

  // ── 2. Rate limit ────────────────────────────────────────────────────────────
  try {
    const ratelimit = getRateLimiter()
    const { success, limit, remaining, reset } = await ratelimit.limit(user.id)
    if (!success) {
      return NextResponse.json(
        { error: '업로드 한도를 초과했습니다. 1시간 후 다시 시도하세요.', limit, remaining: 0, resetAt: new Date(reset).toISOString() },
        { status: 429 }
      )
    }
  } catch (e) {
    console.warn('[parse-csv] Rate limiter unavailable:', e)
  }

  // ── 3. Parse form ────────────────────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 })
  }

  // ── 4. Validate ──────────────────────────────────────────────────────────────
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: '파일 크기가 10MB를 초과합니다' }, { status: 413 })
  }

  const fileName = file.name.toLowerCase()
  const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext))
  const hasValidMime = !file.type || ALLOWED_MIME_TYPES.includes(file.type)

  if (!hasValidExtension && !hasValidMime) {
    return NextResponse.json(
      { error: 'CSV 또는 Excel 파일만 업로드 가능합니다 (.csv, .xlsx, .xls)' },
      { status: 400 }
    )
  }

  // ── 5. Parse (CSV or Excel auto-detected) ────────────────────────────────────
  let parseResult
  try {
    parseResult = await parseKoreanBankCSV(file)
  } catch (e) {
    console.error('[parse-csv] Parse error:', e)
    return NextResponse.json(
      { error: '파일 파싱에 실패했습니다. 파일 형식을 확인해 주세요.' },
      { status: 422 }
    )
  }

  if (!parseResult.transactions.length && parseResult.errors.length) {
    return NextResponse.json(
      {
        error: '지원하지 않는 은행 형식입니다',
        details: parseResult.errors,
        hint: 'KB국민, 신한, 카카오뱅크, 우리, 하나, 기업, 농협, 토스뱅크를 지원합니다. CSV 또는 Excel(.xlsx) 파일을 사용해 주세요.',
      },
      { status: 400 }
    )
  }

  if (!parseResult.transactions.length) {
    return NextResponse.json(
      { error: '거래 내역이 없습니다. 파일을 확인해 주세요.' },
      { status: 422 }
    )
  }

  // ── 6. Upload to Storage ─────────────────────────────────────────────────────
  const admin = createAdminClient()
  const batchId = crypto.randomUUID()
  const ext = fileName.endsWith('.xlsx') ? '.xlsx' : fileName.endsWith('.xls') ? '.xls' : '.csv'
  const storagePath = `${user.id}/${batchId}${ext}`
  const contentType = ext === '.csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

  const fileBytes = await file.arrayBuffer()
  const { error: storageError } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, fileBytes, { contentType, upsert: false })

  if (storageError) {
    console.warn('[parse-csv] Storage upload failed:', storageError.message)
  }

  // ── 7. Insert csv_batch ──────────────────────────────────────────────────────
  const db = admin as any

  const { error: batchError } = await db.from('csv_batches').insert({
    id: batchId,
    user_id: user.id,
    filename: file.name,
    bank_name: parseResult.bankName,
    storage_path: storageError ? null : storagePath,
    total_rows: parseResult.totalRows,
    processed_rows: parseResult.transactions.length,
    status: 'done',
    period_start: parseResult.periodStart || null,
    period_end: parseResult.periodEnd || null,
  })

  if (batchError) {
    console.error('[parse-csv] Batch insert error:', batchError.message)
    return NextResponse.json({ error: '배치 기록 저장에 실패했습니다' }, { status: 500 })
  }

  // ── 8. Bulk upsert transactions ──────────────────────────────────────────────
  const txRows = parseResult.transactions.map((tx) => ({
    user_id: user.id,
    batch_id: batchId,
    tx_hash: generateTxHash(tx.transactionDate, tx.description, tx.amount),
    transaction_date: tx.transactionDate,
    description: tx.description,
    amount: tx.amount,
    bank_name: tx.bankName,
  }))

  const { error: txError } = await db.from('transactions').upsert(txRows, {
    onConflict: 'tx_hash',
    ignoreDuplicates: true,
  })

  if (txError) {
    console.error('[parse-csv] Transaction insert error:', txError.message)
    await db.from('csv_batches').delete().eq('id', batchId)
    return NextResponse.json({ error: '거래 내역 저장에 실패했습니다' }, { status: 500 })
  }

  // ── 9. Response ──────────────────────────────────────────────────────────────
  const preview = parseResult.transactions.slice(0, 5).map((tx) => ({
    transactionDate: tx.transactionDate,
    description: tx.description,
    amount: tx.amount,
  }))

  return NextResponse.json({
    batchId,
    bankName: parseResult.bankName,
    totalRows: parseResult.totalRows,
    savedRows: parseResult.transactions.length,
    periodStart: parseResult.periodStart,
    periodEnd: parseResult.periodEnd,
    preview,
    parseErrors: parseResult.errors.length > 0 ? parseResult.errors : undefined,
  })
}