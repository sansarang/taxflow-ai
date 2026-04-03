import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function verify() {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'TaxFlow AI <onboarding@resend.dev>',
        to: ['etetetetet5ea@kakao.com'],  // 도메인 미인증 시 계정 이메일로만 발송 가능
        subject: 'TaxFlow AI — 이메일 연동 테스트',
        html: '<p>✓ Resend 이메일 연동 성공! TaxFlow AI가 정상 작동합니다.</p>',
      }),
    })
    const data = await res.json()
    if (data.id) {
      console.log('✓ Resend 연결 성공. 이메일 ID:', data.id)
    } else {
      console.error('✗ Resend 오류:', data)
    }
  } catch (e) {
    console.error('✗ Resend 연결 실패:', e)
  }
}

verify()
