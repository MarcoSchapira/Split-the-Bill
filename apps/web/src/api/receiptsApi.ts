import { apiClient } from './client'
import type { User } from './types'

export const MAX_RECEIPT_IMAGE_BYTES = 10 * 1024 * 1024

export type ParsedReceiptItem = {
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export type ParsedReceipt = {
  store_name: string | null;
  store_address: string | null;
  receipt_number: string | null;
  date: string | null;
  time: string | null;
  items: ParsedReceiptItem[];
  item_count: number | null;
  subtotal: number | null;
  other_fees: number | null;
  tax: number | null;
  tip: number | null;
  total: number | null;
  payment_method: string | null;
  card_last_4: string | null;
}

export async function parseReceipt(file: File): Promise<ParsedReceipt> {
  const form = new FormData()
  form.append('image', file, file.name)
  const response = await apiClient.post<{ receipt: ParsedReceipt }>(
    '/receipts/parse',
    form,
    { timeout: 60_000 },
  )
  return response.data.receipt
}

export async function recordAiReceiptConsent(): Promise<User> {
  const response = await apiClient.post<{ user: User }>('/auth/ai-receipt-consent')
  return response.data.user
}
