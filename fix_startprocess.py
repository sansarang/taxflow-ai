with open('src/app/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = '''  function startProcess(file: File) {
    setFileName(file.name)
    setPhase("uploading")
    setUploadPct(0)
    // 업로드 진행률 0→100
    let up = 0
    const upTimer = setInterval(() => {
      up += Math.floor(Math.random() * 12) + 5
      if (up >= 100) {
        up = 100
        setUploadPct(100)
        clearInterval(upTimer)
        // 분석 단계로 전환
        setTimeout(() => {
          setPhase("analyzing")
          setAnalyzePct(0)
          let ap = 0
          const apTimer = setInterval(() => {
            ap += Math.floor(Math.random() * 8) + 3
            if (ap >= 100) {
              ap = 100
              setAnalyzePct(100)
              clearInterval(apTimer)
              setTimeout(() => onComplete(data.results as TxResult[], transactions), 400)
            }
            setAnalyzePct(ap)
          }, 120)
        }, 500)
      }
        }'''

new = '''  async function startProcess(file: File) {
    setFileName(file.name)
    setPhase("uploading")
    setUploadPct(0)
    setError(null)

    // 1. 파일 읽기
    let transactions: TxInput[] = []
    const isImage = file.type.startsWith("image/")

    if (isImage) {
      transactions = [{ description: file.name, amount: 0, date: new Date().toISOString().slice(0,10) }]
    } else {
      const text = await file.text()
      transactions = parseCSV(text)
      if (transactions.length === 0) {
        setError("파일에서 거래내역을 찾을 수 없습니다. CSV 형식을 확인해주세요.")
        setPhase("idle")
        return
      }
    }

    // 2. 업로드 진행률
    let up = 0
    await new Promise<void>(resolve => {
      const upTimer = setInterval(() => {
        up += Math.floor(Math.random() * 12) + 5
        if (up >= 100) { up = 100; setUploadPct(100); clearInterval(upTimer); resolve() }
        else setUploadPct(up)
      }, 60)
    })

    await new Promise(r =    // 3. 분석 진행률 (90%까지만 — API 완료 시 100%)
    let ap = 0
    const apTimer = setInterval(() => {
      ap += Math.floor(Math.random() * 6) + 2
      if (ap >= 90) { ap = 90; clearInterval(apTimer) }
      setAnalyzePct(ap)
    }, 100)

    // 4. 실제 AI API 호출
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

      if (data.upgradeRequired) {
        setError(data.message)
        setPhase("idle")
        return
      }
      if (!data.success || !data.results?.length) {
        setError(data.message || "분석 결과가 없습니다. 다시 시도해주세요.")
        setPhase("idle")
        return
      }
      onComplete(data.results as TxResult[], transactions)
    } catch (e) {
     .")
      setPhase("idle")
    }
  }'''

if old in content:
    content = content.replace(old, new)
    print("교체 성공")
else:
    print("ERROR: 원본 텍스트를 찾지 못했습니다")
    import sys; sys.exit(1)

with open('src/app/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("done")
