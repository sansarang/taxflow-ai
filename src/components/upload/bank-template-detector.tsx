'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

const SUPPORTED_BANKS = [
  '국민은행', '신한은행', '하나은행', '우리은행',
  '카카오뱅크', '토스뱅크', '기업은행', '농협은행',
]

export function BankTemplateDetector() {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="mb-3 text-sm font-medium text-slate-700">지원 은행 형식</p>
        <div className="flex flex-wrap gap-2">
          {SUPPORTED_BANKS.map((bank) => (
            <Badge key={bank} variant="secondary" className="text-xs">
              {bank}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
