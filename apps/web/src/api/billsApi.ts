import { apiClient } from './client'
import type { Bill } from './types'

export type BillShareInput = {
  userId: string;
  shareCents: number;
};

export type BillInput = {
  description: string;
  incurredAt: string;
  totalCents: number;
  targetType: 'friendship' | 'group';
  targetId: string;
  payerId: string;
  shares?: BillShareInput[];
}

export async function listBills(
  target?: { targetType: 'friendship' | 'group'; targetId: string },
): Promise<Bill[]> {
  const response = await apiClient.get<{ bills: Bill[] }>('/bills', {
    params: target,
  })
  return response.data.bills
}

export async function createBill(input: BillInput): Promise<Bill> {
  const response = await apiClient.post<{ bill: Bill }>('/bills', input)
  return response.data.bill
}

export async function updateBill(billId: string, input: BillInput): Promise<Bill> {
  const response = await apiClient.patch<{ bill: Bill }>(`/bills/${billId}`, input)
  return response.data.bill
}

export async function deleteBill(billId: string): Promise<void> {
  await apiClient.delete(`/bills/${billId}`)
}
