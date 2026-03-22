export interface VietQrBankOption {
  code: string
  name: string
}

export const VIET_QR_BANK_OPTIONS: VietQrBankOption[] = [
  { code: 'VCB', name: 'Vietcombank' },
  { code: 'BIDV', name: 'BIDV' },
  { code: 'VTB', name: 'VietinBank' },
  { code: 'MB', name: 'MBBank' },
  { code: 'TCB', name: 'Techcombank' },
  { code: 'ACB', name: 'ACB' },
  { code: 'TPB', name: 'TPBank' },
  { code: 'STB', name: 'Sacombank' },
]

export const getVietQrBankByCode = (code?: string) => {
  if (!code) {
    return undefined
  }

  return VIET_QR_BANK_OPTIONS.find((bank) => bank.code === code.trim().toUpperCase())
}

export const buildVietQrImageUrl = (input: {
  bankCode?: string
  accountNumber?: string
  accountHolder?: string
  amount?: number
  orderCode?: string
}) => {
  const bankCode = input.bankCode?.trim().toUpperCase()
  const accountNumber = input.accountNumber?.trim()

  if (!bankCode || !accountNumber) {
    return null
  }

  const params = new URLSearchParams()

  if (typeof input.amount === 'number' && Number.isFinite(input.amount) && input.amount > 0) {
    params.set('amount', String(Math.round(input.amount)))
  }

  if (input.orderCode?.trim()) {
    params.set('addInfo', `Hoan tien ${input.orderCode.trim()}`)
  }

  if (input.accountHolder?.trim()) {
    params.set('accountName', input.accountHolder.trim())
  }

  return `https://img.vietqr.io/image/${bankCode}-${accountNumber}-compact2.png${
    params.size > 0 ? `?${params.toString()}` : ''
  }`
}
