import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { detectBank, getBankDisplayName } from './bank-detector'
import type { BankCode } from './bank-detector'

export interface ParsedTransaction {
  transactionDate: string
  description: string
  amount: number
  bankName: string
  rawRow: Record<string, string>
}

export interface ParseResult {
  transactions: ParsedTransaction[]
  bankName: string
  periodStart: string
  periodEnd: string
  errors: string[]
  totalRows: number
}

const EUC_KR_BANKS: BankCode[] = ['kb', 'woori', 'nh', 'ibk']

export async function parseKoreanBankCSV(file: File): Promise<ParseResult> {
  const isExcel =
    file.name.endsWith('.xlsx') ||
    file.name.endsWith('.xls') ||
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.type === 'application/vnd.ms-excel'

  if (isExcel) return parseExcelFile(file)
  return parseCsvFile(file)
}

export async function parseExcelFile(file: File): Promise<ParseResult> {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true })

  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]

  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    dateNF: 'yyyy-mm-dd',
  }) as string[][]

  if (rows.length < 2) {
    return { transactions: [], bankName: '알 수 없음', periodStart: '', periodEnd: '', errors: ['파일이 비어있습니다'], totalRows: 0 }
  }

  let headerRowIdx = 0
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    if (rows[i].filter(Boolean).length >= 3) { headerRowIdx = i; break }
  }

  const headers = rows[headerRowIdx].map((h) => String(h ?? '').trim())
  const bankCode = detectBank(headers)

  if (!bankCode) {
    return {
      transactions: [],
      bankName: '알 수 없음',
      periodStart: '',
      periodEnd: '',
      errors: [`지원하지 않는 은행 형식입니다. 헤더: ${headers.slice(0, 6).join(', ')}`],
      totalRows: 0,
    }
  }

  const bankName = getBankDisplayName(bankCode)
  const errors: string[] = []
  const transactions: ParsedTransaction[] = []

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every((c) => !c)) continue
    const rowObj: Record<string, string> = {}
    headers.forEach((h, idx) => { rowObj[h] = String(row[idx] ?? '').trim() })
    try {
      const tx = parseRow(rowObj, bankCode, bankName)
      if (tx) transactions.push(tx)
    } catch (e) {
      errors.push(`행 ${i + 1}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const dates = transactions.map((t) => t.transactionDate).sort()
  return {
    transactions,
    bankName,
    periodStart: dates[0] ?? '',
    periodEnd: dates[dates.length - 1] ?? '',
    errors,
    totalRows: rows.length - headerRowIdx - 1,
  }
}

async function parseCsvFile(file: File): Promise<ParseResult> {
  const rawBuffer = await file.arrayBuffer()
  const utf8Preview = new TextDecoder('utf-8').decode(rawBuffer.slice(0, 512))
  const previewHeaders = utf8Preview.split('\n')[0].split(',').map((h) => h.trim().replace(/^["']+|["']+$/g, ''))
  const previewBank = detectBank(previewHeaders)

  const needsEucKr = previewBank ? EUC_KR_BANKS.includes(previewBank) : false
  const csvText = needsEucKr
    ? new TextDecoder('euc-kr').decode(rawBuffer)
    : new TextDecoder('utf-8').decode(rawBuffer)

  const cleanText = csvText.replace(/^\uFEFF/, '')

  const parsed = Papa.parse<Record<string, string>>(cleanText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => v.trim(),
  })

  const headers = parsed.meta.fields ?? []
  const bankCode = detectBank(headers)

  if (!bankCode) {
    return {
      transactions: [],
      bankName: '알 수 없음',
      periodStart: '',
      periodEnd: '',
      errors: [`지원하지 않는 은행 형식입니다. 헤더: ${headers.slice(0, 6).join(', ')}`],
      totalRows: 0,
    }
  }

  const bankName = getBankDisplayName(bankCode)
  const errors: string[] = []
  const transactions: ParsedTransaction[] = []

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i]
    try {
      const tx = parseRow(row, bankCode, bankName)
      if (tx) transactions.push(tx)
    } catch (e) {
      errors.push(`행 ${i + 2}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const dates = transactions.map((t) => t.transactionDate).sort()
  return {
    transactions,
    bankName,
    periodStart: dates[0] ?? '',
    periodEnd: dates[dates.length - 1] ?? '',
    errors,
    totalRows: parsed.data.length,
  }
}

function parseRow(row: Record<string, string>, bank: BankCode, bankName: string): ParsedTransaction | null {
  switch (bank) {
    case 'kb':      return parseKb(row, bankName)
    case 'shinhan': return parseShinhan(row, bankName)
    case 'woori':   return parseWoori(row, bankName)
    case 'hana':    return parseHana(row, bankName)
    case 'ibk':     return parseIbk(row, bankName)
    case 'nh':      return parseNh(row, bankName)
    case 'kakao':   return parseKakao(row, bankName)
    case 'toss':    return parseToss(row, bankName)
  }
}

function parseKb(row: Record<string, string>, bankName: string): ParsedTransaction | null {
  const date = normDate(row['거래일자'], 'dot')
  const description = row['거래내용'] ?? ''
  const income = parseAmount(row['입금(원)'])
  const expense = parseAmount(row['출금(원)'])
  const amount = income > 0 ? income : -expense
  return makeRow({ date, description, amount, bankName, rawRow: row })
}

function parseShinhan(row: Record<string, string>, bankName: string): ParsedTransaction | null {
  const date = normDate(row['날짜'], 'dash')
  const description = row['내용'] ?? ''
  const income = parseAmount(row['맡기신금액'])
  const expense = parseAmount(row['찾으신금액'])
  const amount = income > 0 ? income : -expense
  return makeRow({ date, description, amount, bankName, rawRow: row })
}

function parseWoori(row: Record<string, string>, bankName: string): ParsedTransaction | null {
  const date = normDate(row['거래일'], 'compact')
  const description = row['거래내용'] ?? ''
  const income = parseAmount(row['입금금액'])
  const expense = parseAmount(row['출금금액'])
  const amount = income > 0 ? income : -expense
  return makeRow({ date, description, amount, bankName, rawRow: row })
}

function parseHana(row: Record<string, string>, bankName: string): ParsedTransaction | null {
  const date = normDate(row['거래일자'], 'slash')
  const description = row['적요'] ?? ''
  const rawAmount = parseAmount(row['거래금액'])
  const type = (row['거래구분'] ?? '').trim()
  const amount = type === '입금' ? rawAmount : -rawAmount
  return makeRow({ date, description, amount, bankName, rawRow: row })
}

function parseIbk(row: Record<string, string>, bankName: string): ParsedTransaction | null {
  const date = normDate(row['거래일자'], 'dot')
  const description = row['내용'] ?? ''
  const income = parseAmount(row['입금액'])
  const expense = parseAmount(row['출금액'])
  const amount = income > 0 ? income : -expense
  return makeRow({ date, description, amount, bankName, rawRow: row })
}

function parseNh(row: Record<string, string>, bankName: string): ParsedTransaction | null {
  const date = normDate(row['거래일자'], 'dot')
  const description = row['거래내용'] ?? ''
  const rawAmount = parseAmount(row['거래금액'])
  const type = (row['거래구분'] ?? '').trim()
  const amount = type === '입금' ? rawAmount : -rawAmount
  return makeRow({ date, description, amount, bankName, rawRow: row })
}

function parseKakao(row: Record<string, string>, bankName: string): ParsedTransaction | null {
  const rawDate = (row['거래일시'] ?? '').split(' ')[0]
  const date = normDate(rawDate, 'dash')
  const description = row['메모'] || row['거래유형'] || ''
  const rawAmount = parseAmount(row['거래금액'])
  const type = (row['거래유형'] ?? '').trim()
  const isIncome = type === '입금' || type.includes('입금')
  const amount = isIncome ? rawAmount : -rawAmount
  return makeRow({ date, description, amount, bankName, rawRow: row })
}

function parseToss(row: Record<string, string>, bankName: string): ParsedTransaction | null {
  const date = normDate(row['날짜'], 'dot')
  const description = row['내용'] ?? ''
  const rawAmount = parseAmount(row['금액'])
  const type = (row['구분'] ?? '').trim()
  const amount = type === '입금' ? rawAmount : -rawAmount
  return makeRow({ date, description, amount, bankName, rawRow: row })
}

interface RowInput {
  date: string; description: string; amount: number; bankName: string; rawRow: Record<string, string>
}

function makeRow({ date, description, amount, bankName, rawRow }: RowInput): ParsedTransaction | null {
  const cleanDesc = description.trim()
  if (!cleanDesc || amount === 0 || !date) return null
  return { transactionDate: date, description: cleanDesc, amount, bankName, rawRow }
}

function parseAmount(raw: string | undefined): number {
  if (!raw) return 0
  const num = Number(raw.replace(/,/g, '').trim())
  return isNaN(num) ? 0 : Math.abs(num)
}

type DateFormat = 'dot' | 'dash' | 'slash' | 'compact'

function normDate(raw: string | undefined, fmt: DateFormat): string {
  if (!raw) return ''
  const s = raw.trim()
  switch (fmt) {
    case 'dot':
      return s.replace(/\./g, '-').replace(/(\d{4})-(\d{1,2})-(\d{1,2})/, (_, y, m, d) =>
        `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`)
    case 'dash':
      return s.replace(/(\d{4})-(\d{1,2})-(\d{1,2})/, (_, y, m, d) =>
        `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`)
    case 'slash':
      return s.replace(/\//g, '-').replace(/(\d{4})-(\d{1,2})-(\d{1,2})/, (_, y, m, d) =>
        `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`)
    case 'compact':
      return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s
  }
}