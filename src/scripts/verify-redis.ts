import { Redis } from '@upstash/redis'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

async function verify() {
  try {
    await redis.set('taxflow:ping', 'ok', { ex: 60 })
    const val = await redis.get('taxflow:ping')
    console.log(val === 'ok' ? '✓ Redis 연결 성공' : '✗ Redis 응답 오류')
    await redis.del('taxflow:ping')
  } catch (e) {
    console.error('✗ Redis 연결 실패:', e)
  }
}

verify()
