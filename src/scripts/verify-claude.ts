import Anthropic from '@anthropic-ai/sdk'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function verify() {
  try {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16,
      messages: [{ role: 'user', content: '한국어로 "연결 성공"이라고만 답해' }],
    })
    const text = (msg.content[0] as any).text
    console.log('✓ Claude API 연결 성공:', text)
  } catch (e) {
    console.error('✗ Claude API 연결 실패:', e)
  }
}

verify()
