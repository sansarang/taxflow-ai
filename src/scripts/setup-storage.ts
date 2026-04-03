/**
 * setup-storage.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Creates the required Supabase Storage buckets for TaxFlow AI.
 *
 * Run after applying the SQL migration:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> npx tsx src/scripts/setup-storage.ts
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://cxflqrgbbmoxymewdvlx.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function setup() {
  const buckets = [
    { name: 'csv-uploads', fileSizeLimit: 10_485_760 },   // 10 MB
    { name: 'tax-reports', fileSizeLimit: 52_428_800 },   // 50 MB
  ]

  for (const b of buckets) {
    const { error } = await supabase.storage.createBucket(b.name, {
      public: false,
      fileSizeLimit: b.fileSizeLimit,
    })

    if (error && !error.message.includes('already exists')) {
      console.error(`✗ ${b.name}:`, error.message)
    } else {
      console.log(`✓ Bucket ready: ${b.name}`)
    }
  }

  console.log('Done.')
}

setup()
