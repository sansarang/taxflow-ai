import { z } from 'zod'

export const csvRowSchema = z.object({
  date: z.string().min(1, '날짜는 필수입니다'),
  description: z.string().min(1, '내용은 필수입니다'),
  amount: z.number({ message: '금액은 숫자여야 합니다' }),
})

export const csvUploadSchema = z.object({
  file: z
    .instanceof(File)
    .refine((f) => f.size <= 10 * 1024 * 1024, '파일 크기는 10MB 이하여야 합니다')
    .refine(
      (f) => f.type === 'text/csv' || f.name.endsWith('.csv'),
      'CSV 파일만 업로드 가능합니다'
    ),
})

export type CsvRow = z.infer<typeof csvRowSchema>
export type CsvUpload = z.infer<typeof csvUploadSchema>
