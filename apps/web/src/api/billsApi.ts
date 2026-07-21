import { apiClient } from './client'
import type { Bill } from './types'

export type BillShareInput = {
  userId: string;
  shareCents: number;
  lenderId?: string;
};

export type BillLineItemInput = {
  name: string;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
  assignedUserIds: string[];
};

export type BillInput = {
  description: string;
  incurredAt: string;
  totalCents: number;
  payerId?: string;
  source?: 'manual' | 'capture';
  isOneMainTotal?: boolean;
  isSplitWithFriends?: boolean;
  isSplitWithGroup?: boolean;
  groupId?: string | null;
  isSplitByFinalAmounts?: boolean;
  participantIds?: string[];
  storeName?: string | null;
  storeAddress?: string | null;
  receiptNumber?: string | null;
  receiptDate?: string | null;
  receiptTime?: string | null;
  paymentMethod?: string | null;
  cardLast4?: string | null;
  itemCount?: number | null;
  subtotalCents?: number | null;
  otherFeesCents?: number | null;
  taxCents?: number | null;
  tipCents?: number | null;
  lineItems?: BillLineItemInput[];
  shares?: BillShareInput[];
}

export async function listBills(
  query?: { participantId?: string; friendUserId?: string; groupId?: string },
): Promise<Bill[]> {
  const response = await apiClient.get<{ bills: Bill[] }>('/bills', {
    params: query,
  })
  return response.data.bills
}

export async function getBill(billId: string): Promise<Bill> {
  const response = await apiClient.get<{ bill: Bill }>(`/bills/${billId}`)
  return response.data.bill
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

export async function settleBill(
  billId: string,
  friendUserId?: string,
  participantUserId?: string,
): Promise<Bill> {
  const response = await apiClient.post<{ bill: Bill }>(`/bills/${billId}/settle`, null, {
    params: friendUserId
      ? { friendUserId }
      : participantUserId
        ? { participantUserId }
        : undefined,
  })
  return response.data.bill
}
