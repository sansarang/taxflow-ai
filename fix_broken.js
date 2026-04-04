const fs = require('fs')
let c = fs.readFileSync('src/app/page.tsx', 'utf8')

// 1. Content-Type 깨진 부분 수정
c = c.replace(
  "headers: { 'Conten       body: JSON.stringify({ transactions }),\n          })",
  "headers: { 'Content-Type': 'application/json' },\n            body: JSON.stringify({ transactions }),\n          })"
)

// 2. OString() 깨진 부분 수정
c = c.replace(
  'new Date().OString().slice(0, 10)',
  'new Date().toISOString().slice(0, 10)'
)

fs.writeFileSync('src/app/page.tsx', c, 'utf8')
console.log('done')
