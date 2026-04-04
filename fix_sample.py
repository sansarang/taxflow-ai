with open('src/app/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# SAMPLE 하드코딩 제거 - onComplete(SAMPLE) 만 교체
content = content.replace(
    'setTimeout(() => onComplete(SAMPLE), 400)',
    'setTimeout(() => onComplete(data.results as TxResult[], transactions), 400)'
)

# TxInput 타입 확장
content = content.replace(
    'interface TxInput {\n  description: string\n  amount: number\n  date: string\n}',
    'interface TxInput {\n  description: string\n  amount: number\n  date: string\n  base64?: string\n  mimeType?: string\n}'
)

with open('src/app/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('done')
