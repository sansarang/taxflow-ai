import crypto from 'crypto'

/**
 * Generate a 16-character hex SHA-256 hash used as the deduplication key
 * (tx_hash) for transactions in the database.
 *
 * The composite key `date|description|amount` is deterministic: uploading the
 * same bank CSV twice will produce identical hashes, allowing upsert-based
 * deduplication at the DB level.
 */
export function generateTxHash(
  date: string,
  description: string,
  amount: number
): string {
  return crypto
    .createHash('sha256')
    .update(`${date}|${description}|${amount}`)
    .digest('hex')
    .substring(0, 16)
}

/**
 * Legacy djb2 string hash kept for non-security purposes
 * (e.g., generating short IDs in browser contexts where crypto is not available).
 */
export function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}
