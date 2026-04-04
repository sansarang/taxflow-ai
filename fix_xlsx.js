const fs = require('fs')
let c = fs.readFileSync('src/app/page.tsx', 'utf8')

const xlsxHandler = `  async function startProcess(file: File) {
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      try {
        const XLSX = await import('xlsx')
        const buffer = await file.arrayBuffer()
        const wb = XLSX.read(buffer, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][]
        const transactions: TxInput[] = []
        for (let i = 1; i < Math.min(rows.length, 21); i++) {
          const row = rows[i]
          if (!row || row.length < 2) continue
          const amount = parseFloat(String(row[2] || row[1] || '0').replace(/,/g, ''))
          if (isNaN(amount) || amount === 0) continue
          transactions.push({
            description: String(row[0] || '거래 ' + i),
            amount: -Math.abs(amount),
            date: String(row[3] || new Date().OString().slice(0, 10))
          })
        }
        if (transactions.length === 0) {
          setError('엑셀 파일에서 거래내역을 찾을 수 없습니다.')
          setPhase('idle')
          return
        }
        setFileName(file.name)
        setPhase('uploading')
        setUploadPct(0)
        setError(null)
        let up = 0
        await new Promise(resolve => {
          const t = setInterval(() => {
            up += 15
            if (up >= 100) { setUploadPct(100); clearInterval(t); resolve(undefined) }
            else setUploadPct(up)
          }, 60)
        })
        await new Promise(r => setTimeout(r, 400))
        setPhase('analyzing')
        setAnalyzePct(0)
        let ap = 0
        const apTimer = setInterval(() => {
          ap += 4
          if (ap >= 90) { ap = 90; clearInterval(apTimer) }
          setAnalyzePct(ap)
        }, 100)
        try {
          const res = await fetch('/api/demo-classify', {
            method: 'POST',
            headers: { 'Conten       body: JSON.stringify({ transactions }),
          })
          const data = await res.json()
          clearInterval(apTimer)
          setAnalyzePct(100)
          await new Promise(r => setTimeout(r, 300))
          if (data.upgradeRequired) { setError(data.message); setPhase('idle'); return }
          if (!data.success || !data.results || data.results.length === 0) {
            setError(data.message || '분석 결과가 없습니다.')
            setPhase('idle')
            return
          }
          onComplete(data.results as TxResult[])
        } catch {
          clearInterval(apTimer)
          setError('네트워크 오류가 발생했습니다.')
          setPhase('idle')
        }
        return
      } catch {
        setError('엑셀 파일을 읽을 수 없습니다.')
        setPhase('idle')
        return
      }
    }`

c = c.replace('  async function startProcess(file: File) {', xlsxHandler)
fs.writeFileSync('src/app/page.tsx', c, 'utf8')
console.log('done')
