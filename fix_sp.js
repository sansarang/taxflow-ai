const fs = require('fs')
let c = fs.readFileSync('src/app/page.tsx', 'utf8')

// 1. sync -> async
c = c.replace('function startProcess(file: File)', 'async function startProcess(file: File)')

// 2. 내부 타이머 로직 전체 교체
const oldBody = /\/\/ 업로드 진행률 0→100[\s\S]*?setUploadPct\(up\)\n    }, 80\)\n  \}/
const newBody = `// 파일 읽기
    let transactions = []
    if (file.type.startsWith("image/")) {
      transactions = [{ description: file.name, amount: 0, date: new Date().toISOString().slice(0,10) }]
    } else {
      const text = await file.text()
      transactions = parseCSV(text)
      if (transactions.length === 0) {
        setError("거래내역을 찾을 수 없습니다.")
        setPhase("idle")
        return
      }
    }
    // 업로드 진행률
    let up = 0
    await new Promise(function(resolve) {
      const t = setInterval(function() {
        up += Math.floor(Math.random()*12)+5
        if (up >= 100) { setUploadPct(1}, 60)
    })
    await new Promise(function(r){ setTimeout(r, 400) })
    setPhase("analyzing")
    setAnalyzePct(0)
    let ap = 0
    const apTimer = setInterval(function() {
      ap += Math.floor(Math.random()*6)+2
      if (ap >= 90) { ap = 90; clearInterval(apTimer) }
      setAnalyzePct(ap)
    }, 100)
    try {
      const res = await fetch("/api/demo-classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions }),
      })
      const data = await res.json()
      clearInterval(apTimer)
      setAnalyzePct(100)
      await new Promise(function(r){ setTimeout(r, 300) })
      if (data.upgradeRequired) { setError(data.message); setPhase("idle"); return }
      if (!data.success || !data.results || data.results.length === 0) {
        setError(data.message || "분석 결과가 없습니다.")
        setPhase("idle")
        return
      }
      onComplete(data.results)
    } catch(e) {
      clearInterval(apTimer)
      set했습니다.")
      setPhase("idle")
    }
  }`

if (oldBody.test(c)) {
  c = c.replace(oldBody, newBody)
  console.log("교체 성공")
} else {
  console.log("패턴 불일치 - 수동 확인 필요")
}

fs.writeFileSync('src/app/page.tsx', c, 'utf8')
console.log("done")
