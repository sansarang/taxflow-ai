with open('src/app/page.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_func = '''  async function startProcess(file: File) {
    setFileName(file.name)
    setPhase("uploading")
    setUploadPct(0)

    // 1. 파일 읽기
    let transactions: TxInput[] = []
    if (file.type.startsWith("image/")) {
      transactions = [{ description: file.name, amount: 0, date: new Date().toISOString().slice(0,10) }]
    } else {
      const text = await file.text()
      transactions = parseCSV(text)
      if (transactions.length === 0) {
        setError("파일에서 거래내역을 찾을 수 없습니다.")
        setPhase("idle")
        return
      }
    }

    // 2. 업로드 진행률
    let up = 0
    await new Promise<void>(resolve => {
      const t = setInterval(() => {
        up += Math.floor(Math.random()*12)+5
        if (up >= 100) { setUploadPct(100); clearInterval(t); resolve() }
        else setUploadPct(up)
      }, 60)
    })

    await new Promise    setAnalyzePct(0)

    // 3. 분석 진행률
    let ap = 0
    const apTimer = setInterval(() => {
      ap += Math.floor(Math.random()*6)+2
      if (ap >= 90) { ap = 90; clearInterval(apTimer) }
      setAnalyzePct(ap)
    }, 100)

    // 4. 실제 AI 호출
    try {
      const res = await fetch("/api/demo-classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions }),
      })
      const data = await res.json()
      clearInterval(apTimer)
      setAnalyzePct(100)
      await new Promise(r => setTimeout(r, 300))
      if (data.upgradeRequired) { setError(data.message); setPhase("idle"); return }
      if (!data.success || !data.results?.length) { setError(data.message || "분석 결과가 없습니다."); setPhase("idle"); return }
      onComplete(data.results as TxResult[])
    } catch {
      clearInterval(apTimer)
      setError("네트워크 오류가 발생했습니다.")
      setPhase("idle")
    }
  }
'''

# 12
for i, line in enumerate(lines):
    if 'function startProcess(file: File)' in line:
        start = i
    if start and i > start and line.strip() == '}' and end is None:
        # handleDrop 바로 전 닫는 중괄호
        end = i + 1
        break

if start and end:
    lines[start:end] = [new_func]
    with open('src/app/page.tsx', 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print(f"교체 성공: {start}~{end}")
else:
    print(f"ERROR start={start} end={end}")
