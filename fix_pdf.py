content = open('src/lib/export/pdf-report.ts').read()

# recommendations를 string[]으로 처리
old = """    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['#', '제목', '설명', '예상 절감', '난이도']],
      body: topRecs.map((r, i) => [
        i + 1,
        r.title,
        r.description.slice(0, 50),
        formatKoreanCurrency(r.savingsImpact),
        r.difficulty === 'easy' ? '쉬움' : r.difficulty === 'medium' ? '보통' : '어려움',
      ]),
      headStyles: {
        fillColor: BRAND.blue,
        textColor: BRAND.white,
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: { fontSize: 9, cellPadding: 3 },
      alternateRowStyles: { fillColor: BRAND.light },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 40 },
        2: { cellWidth: 70 },
        3: { cellWidth: 28, halign: 'right' },
        4: { cellWidth: 20, halign: 'center' },
      },
    })"""

new = """    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['#', '절세 권고사항']],
      body: (topRecs as string[]).map((r: string, i: number) => [i + 1, r]),
      headStyles: {
        fillColor: BRAND.blue,
        textColor: BRAND.white,
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: { fontSize: 9, cellPadding: 3 },
      alternateRowStyles: { fillColor: BRAND.light },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 160 },
      },
    })"""

content = content.replace(old, new)

# creatorSpecificAlerts → anomalyAlerts
old2 = """  const creatorAlerts = optimizerResult?.creatorSpecificAlerts ?? []
  if (creatorAlerts.length > 0) {
    const afterRecs =
      (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? y + 40
    const alertsY = afterRecs + 10

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...BRAND.navy)
    doc.text('크리에이터 특화 알림', MARGIN, alertsY)

    autoTable(doc, {
      startY: alertsY + 5,
      margin: { left: MARGIN, right: MARGIN },
      head: [['크리에이터 절세 알림']],
      body: creatorAlerts.slice(0, 5).map((a) => [a]),
      headStyles: {
        fillColor: BRAND.amber,
        textColor: BRAND.white,
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: { fontSize: 9, cellPadding: 3 },
    })
  }"""

new2 = """  const creatorAlerts = (optimizerResult?.anomalyAlerts ?? []).map((a: any) => a.message ?? '')
  if (creatorAlerts.length > 0) {
    const afterRecs =
      (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? y + 40
    const alertsY = afterRecs + 10

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...BRAND.navy)
    doc.text('이상 거래 알림', MARGIN, alertsY)

    autoTable(doc, {
      startY: alertsY + 5,
      margin: { left: MARGIN, right: MARGIN },
      head: [['알림 내용']],
      body: creatorAlerts.slice(0, 5).map((a: string) => [a]),
      headStyles: {
        fillColor: BRAND.amber,
        textColor: BRAND.white,
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: { fontSize: 9, cellPadding: 3 },
    })
  }"""

content = content.replace(old2, new2)

open('src/lib/export/pdf-report.ts', 'w').write(content)
print('done')