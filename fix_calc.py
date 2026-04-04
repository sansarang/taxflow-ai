content = open('src/lib/tax/calculator.ts').read()

content = content.replace(
    "import type { ClassifiedTransaction } from '@/lib/ai/optimizer'",
    "// ClassifiedTransaction replaced with any"
)
content = content.replace(
    'transactions: ClassifiedTransaction[]',
    'transactions: any[]'
)
content = content.replace(
    '(t) => t.amount < 0',
    '(t: any) => t.amount < 0'
)
content = content.replace(
    '(t) => t.receiptRequired && !t.manuallyReviewed',
    '(t: any) => t.receiptRequired && !t.manuallyReviewed'
)
content = content.replace(
    "(t) => !t.taxCategory || t.taxCategory === '402'",
    "(t: any) => !t.taxCategory || t.taxCategory === '402'"
)
content = content.replace(
    '(t) => t.amount < -HIGH_AMOUNT && !t.manuallyReviewed',
    '(t: any) => t.amount < -HIGH_AMOUNT && !t.manuallyReviewed'
)

open('src/lib/tax/calculator.ts', 'w').write(content)
print('done')