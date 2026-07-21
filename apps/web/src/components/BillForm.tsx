import * as AlertDialog from '@radix-ui/react-alert-dialog'
import * as Dialog from '@radix-ui/react-dialog'
import {
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from 'react'
import { useBlocker } from 'react-router-dom'
import { createBill, updateBill, type BillInput, type BillLineItemInput } from '../api/billsApi'
import { apiErrorMessage } from '../api/client'
import { getGroup } from '../api/groupsApi'
import {
  MAX_RECEIPT_IMAGE_BYTES,
  parseReceipt,
  recordAiReceiptConsent,
  type ParsedReceipt,
} from '../api/receiptsApi'
import { invalidateBillData } from '../api/queryClient'
import type {
  Bill,
  FriendshipSummary,
  GroupDetail,
  GroupSummary,
  User,
} from '../api/types'
import { useAuth } from '../auth/useAuth'
import { useDialogFocus } from './ui/useDialogFocus'
import {
  allocateItemizedShares,
  equalShareCents,
  formatCentsAsAmount,
  parseAmountToCents,
  sharesMatchEqualSplit,
} from '../utils/billSplit'
import { displayName, formatCad } from '../utils/format'
import '../styles/bills.css'

type TargetMode = 'solo' | 'friends' | 'group'
type ContentMode = 'total' | 'items'
type SplitMode = 'equal' | 'custom' | 'items'

type LineItemDraft = {
  key: string;
  name: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
  assignedUserIds: string[];
}

type BillFormProps = {
  bill?: Bill;
  friends: FriendshipSummary[];
  groups?: GroupSummary[];
  fixedFriend?: FriendshipSummary;
  initialFriendshipId?: string | null;
  initialGroupId?: string | null;
  onCancel: () => void;
  onSaved: (bill: Bill) => void;
}

let nextLineItemKey = 0

function lineItemKey() {
  nextLineItemKey += 1
  return `line-${nextLineItemKey}`
}

function nullable(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function moneyValue(cents: number | null | undefined): string {
  return cents == null ? '' : formatCentsAsAmount(cents)
}

function dollarsValue(value: number | null | undefined): string {
  return value == null ? '' : value.toFixed(2)
}

function initialTarget(bill?: Bill): TargetMode {
  if (bill?.isSplitWithGroup) return 'group'
  if (bill?.isSplitWithFriends) return 'friends'
  return 'solo'
}

function initialSplitMode(bill?: Bill): SplitMode {
  if (!bill || !bill.isSplitWithFriends || bill.isSplitWithGroup) return 'equal'
  if (!bill.isSplitByFinalAmounts) return 'items'
  return sharesMatchEqualSplit(
    bill.totalCents,
    bill.shares.map((share) => ({ userId: share.user.id, shareCents: share.shareCents })),
    bill.payerId,
  )
    ? 'equal'
    : 'custom'
}

function billLineItems(bill?: Bill): LineItemDraft[] {
  if (!bill) return []
  return [...bill.lineItems]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((item) => {
      const quantity = Number(item.quantity)
      return {
        key: lineItemKey(),
        name: item.name,
        // Prisma Decimal may arrive as "2.000"; normalize before editing/saving.
        quantity: Number.isFinite(quantity) ? String(quantity) : '1',
        unitPrice: moneyValue(item.unitPriceCents),
        totalPrice: moneyValue(item.totalPriceCents),
        assignedUserIds: item.assignments.map((assignment) => assignment.user.id),
      }
    })
}

function datePart(value?: string | null): string {
  if (!value) return new Date().toISOString().slice(0, 10)
  return value.slice(0, 10)
}

function timePart(value?: string | null): string {
  if (!value || !value.includes('T')) return ''
  return value.slice(11, 16)
}

function toIncurredAt(date: string, time: string): string {
  return `${date}T${time || '00:00'}:00.000Z`
}

function lineTotalCents(item: LineItemDraft): number | null {
  return parseAmountToCents(item.totalPrice)
}

function sumItemCents(items: LineItemDraft[]): number {
  return items.reduce((sum, item) => sum + (lineTotalCents(item) ?? 0), 0)
}

function parsedReceiptItems(receipt: ParsedReceipt): LineItemDraft[] {
  return receipt.items.map((item) => ({
    key: lineItemKey(),
    name: item.name,
    quantity: String(item.quantity),
    unitPrice: dollarsValue(item.unit_price),
    totalPrice: dollarsValue(item.total_price),
    assignedUserIds: [],
  }))
}

export function BillForm({
  bill,
  fixedFriend,
  friends,
  groups = [],
  initialFriendshipId,
  initialGroupId,
  onCancel,
  onSaved,
}: BillFormProps) {
  const auth = useAuth()
  const currentUser = auth.user
  const contextualFriendshipId = fixedFriend?.id ?? initialFriendshipId ?? null
  const contextualFriend = friends.find((friendship) => friendship.id === contextualFriendshipId)
  const initialFriendIds = bill
    ? bill.shares
        .map((share) => share.user.id)
        .filter((userId) => userId !== currentUser?.id)
    : contextualFriend
      ? [contextualFriend.friend.id]
      : []

  const [target, setTarget] = useState<TargetMode>(
    bill ? initialTarget(bill) : initialGroupId ? 'group' : contextualFriend ? 'friends' : 'solo',
  )
  const [contentMode, setContentMode] = useState<ContentMode>(
    bill?.isOneMainTotal === false ? 'items' : 'total',
  )
  const [splitMode, setSplitMode] = useState<SplitMode>(initialSplitMode(bill))
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>(initialFriendIds)
  const [selectedGroupId, setSelectedGroupId] = useState(
    bill ? bill.groupId ?? '' : initialGroupId ?? groups[0]?.id ?? '',
  )
  const [groupDetail, setGroupDetail] = useState<GroupDetail | null>(null)
  const [groupError, setGroupError] = useState<string | null>(null)
  const [isLoadingGroup, setIsLoadingGroup] = useState(false)
  const [description, setDescription] = useState(bill?.description ?? '')
  const [incurredDate, setIncurredDate] = useState(datePart(bill?.incurredAt))
  const [incurredTime, setIncurredTime] = useState(timePart(bill?.incurredAt))
  const [totalAmount, setTotalAmount] = useState(moneyValue(bill?.totalCents))
  const [payerId, setPayerId] = useState(bill?.payerId ?? currentUser?.id ?? '')
  const [source, setSource] = useState<'manual' | 'capture'>(bill?.source ?? 'manual')
  const [storeName, setStoreName] = useState(bill?.storeName ?? '')
  const [storeAddress, setStoreAddress] = useState(bill?.storeAddress ?? '')
  const [receiptNumber, setReceiptNumber] = useState(bill?.receiptNumber ?? '')
  const [receiptDate, setReceiptDate] = useState(bill?.receiptDate ?? '')
  const [receiptTime, setReceiptTime] = useState(bill?.receiptTime ?? '')
  const [paymentMethod, setPaymentMethod] = useState(bill?.paymentMethod ?? '')
  const [cardLast4, setCardLast4] = useState(bill?.cardLast4 ?? '')
  const [itemCount, setItemCount] = useState(bill?.itemCount == null ? '' : String(bill.itemCount))
  const [subtotalAmount, setSubtotalAmount] = useState(moneyValue(bill?.subtotalCents))
  const [taxAmount, setTaxAmount] = useState(moneyValue(bill?.taxCents))
  const [tipAmount, setTipAmount] = useState(moneyValue(bill?.tipCents))
  const [feesAmount, setFeesAmount] = useState(moneyValue(bill?.otherFeesCents))
  const [items, setItems] = useState<LineItemDraft[]>(billLineItems(bill))
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (bill?.shares ?? []).map((share) => [share.user.id, moneyValue(share.shareCents)]),
    ),
  )
  const [isReviewing, setIsReviewing] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [pendingConsentFile, setPendingConsentFile] = useState<File | null>(null)
  const [showConsent, setShowConsent] = useState(false)
  const [isSavingConsent, setIsSavingConsent] = useState(false)
  const [isParsingReceipt, setIsParsingReceipt] = useState(false)
  const [receiptError, setReceiptError] = useState<string | null>(null)
  const [receiptNotice, setReceiptNotice] = useState<string | null>(null)
  const [hasReceiptConsent, setHasReceiptConsent] = useState(
    Boolean(currentUser?.aiReceiptConsentAt),
  )
  const allowNavigationRef = useRef(false)
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null)
  const consentDialogFocus = useDialogFocus()
  const {
    capture: captureNavigationDialogFocus,
    restore: restoreNavigationDialogFocus,
  } = useDialogFocus()

  const retargetLocked = Boolean(bill && !bill.canRetarget)
  const shouldBlockNavigation = useCallback(
    () => isDirty && !isSaving && !allowNavigationRef.current,
    [isDirty, isSaving],
  )
  const navigationBlocker = useBlocker(shouldBlockNavigation)

  useEffect(() => {
    if (target !== 'group' || !selectedGroupId) return

    let active = true
    const timer = window.setTimeout(() => {
      setIsLoadingGroup(true)
      setGroupError(null)
      void getGroup(selectedGroupId)
        .then((group) => {
          if (active) setGroupDetail(group)
        })
        .catch((requestError) => {
          if (active) {
            setGroupDetail(null)
            setGroupError(apiErrorMessage(requestError, 'Unable to load this group.'))
          }
        })
        .finally(() => {
          if (active) setIsLoadingGroup(false)
        })
    }, 0)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [selectedGroupId, target])

  useEffect(() => {
    if (!isDirty || isSaving) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [isDirty, isSaving])

  useEffect(() => {
    if (!isReviewing) return
    reviewHeadingRef.current?.focus()
  }, [isReviewing])

  useEffect(() => {
    if (!isDirty || isSaving) return
    const captureLinkAttempt = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('a[href]')) {
        captureNavigationDialogFocus()
      }
    }
    document.addEventListener('click', captureLinkAttempt, true)
    return () => document.removeEventListener('click', captureLinkAttempt, true)
  }, [captureNavigationDialogFocus, isDirty, isSaving])

  const peopleById = useMemo(() => {
    const people = new Map<string, User>()
    if (currentUser) people.set(currentUser.id, currentUser)
    for (const friendship of friends) people.set(friendship.friend.id, friendship.friend)
    for (const share of bill?.shares ?? []) people.set(share.user.id, share.user)
    for (const member of groupDetail?.members ?? []) people.set(member.user.id, member.user)
    return people
  }, [bill?.shares, currentUser, friends, groupDetail?.members])

  const historicalFriendParticipants = useMemo(() => {
    const currentFriendIds = new Set(friends.map((friendship) => friendship.friend.id))
    return selectedFriendIds
      .filter((userId) => !currentFriendIds.has(userId))
      .map((userId) => peopleById.get(userId))
      .filter((user): user is User => Boolean(user))
  }, [friends, peopleById, selectedFriendIds])

  const participants = useMemo(() => {
    if (!currentUser) return []
    if (target === 'solo') return [currentUser]
    if (target === 'group') {
      if (bill?.isSplitWithGroup && (bill.groupId ?? '') === selectedGroupId) {
        return bill.shares.map((share) => share.user)
      }
      const groupUsers = groupDetail?.id === selectedGroupId
        ? groupDetail.members.map((member) => member.user)
        : null
      if (groupUsers?.length) return groupUsers
      return []
    }
    return [
      currentUser,
      ...selectedFriendIds
        .map((userId) => peopleById.get(userId))
        .filter((user): user is User => Boolean(user)),
    ]
  }, [bill, currentUser, groupDetail, peopleById, selectedFriendIds, selectedGroupId, target])

  const totalCents = parseAmountToCents(totalAmount)
  const participantIds = participants.map((participant) => participant.id)
  const activePayerId = participantIds.includes(payerId) ? payerId : participantIds[0] ?? ''
  const computedSubtotalCents = sumItemCents(items)
  const isHistoricalDeletedGroup = Boolean(
    bill?.isSplitWithGroup && bill.groupId == null && selectedGroupId === '',
  )
  const preservedSupportingItems = Boolean(
    bill?.isOneMainTotal && bill.lineItems.length > 0 && contentMode === 'total',
  )

  function touch() {
    setIsDirty(true)
    setIsReviewing(false)
    setError(null)
  }

  function chooseTarget(nextTarget: TargetMode) {
    if (retargetLocked || nextTarget === target) return
    touch()
    setTarget(nextTarget)
    setSplitMode('equal')
    if (nextTarget === 'solo') setPayerId(currentUser?.id ?? '')
  }

  function toggleFriend(userId: string) {
    if (retargetLocked) return
    touch()
    setSelectedFriendIds((current) =>
      current.includes(userId)
        ? current.filter((candidate) => candidate !== userId)
        : [...current, userId],
    )
  }

  function chooseContentMode(mode: ContentMode) {
    if (mode === contentMode) return
    touch()
    setContentMode(mode)
    if (mode === 'items' && items.length === 0) {
      setItems([
        { key: lineItemKey(), name: '', quantity: '1', unitPrice: '', totalPrice: '', assignedUserIds: [] },
      ])
    }
    if (mode === 'total' && splitMode === 'items') setSplitMode('equal')
  }

  function updateItem(key: string, patch: Partial<LineItemDraft>, deriveTotal = false) {
    touch()
    setItems((current) => {
      const next = current.map((item) => {
        if (item.key !== key) return item
        const updated = { ...item, ...patch }
        if (!deriveTotal) return updated
        const quantity = Number(updated.quantity)
        const unitCents = parseAmountToCents(updated.unitPrice)
        return {
          ...updated,
          totalPrice:
            Number.isFinite(quantity) && quantity > 0 && unitCents != null
              ? moneyValue(Math.round(quantity * unitCents))
              : '',
        }
      })
      setSubtotalAmount(moneyValue(sumItemCents(next)))
      return next
    })
  }

  function addItem() {
    touch()
    setItems((current) => [
      ...current,
      { key: lineItemKey(), name: '', quantity: '1', unitPrice: '', totalPrice: '', assignedUserIds: [] },
    ])
  }

  function removeItem(key: string, opener: HTMLElement) {
    const row = opener.closest<HTMLElement>('.bc-item-row')
    const nextRow = row?.nextElementSibling?.matches('.bc-item-row') ? row.nextElementSibling : null
    const previousRow = row?.previousElementSibling?.matches('.bc-item-row') ? row.previousElementSibling : null
    const focusTarget = (nextRow ?? previousRow)?.querySelector<HTMLElement>('input')
      ?? row?.parentElement?.querySelector<HTMLElement>('.bc-items-head button')

    touch()
    setItems((current) => {
      const next = current.filter((item) => item.key !== key)
      setSubtotalAmount(moneyValue(sumItemCents(next)))
      return next
    })
    window.requestAnimationFrame(() => focusTarget?.focus())
  }

  function toggleAssignment(key: string, userId: string) {
    const item = items.find((candidate) => candidate.key === key)
    if (!item) return
    updateItem(key, {
      assignedUserIds: item.assignedUserIds.includes(userId)
        ? item.assignedUserIds.filter((candidate) => candidate !== userId)
        : [...item.assignedUserIds, userId],
    })
  }

  function applyParsedReceipt(receipt: ParsedReceipt) {
    const nextItems = parsedReceiptItems(receipt)
    const parsedSubtotal = receipt.subtotal == null
      ? sumItemCents(nextItems)
      : Math.round(receipt.subtotal * 100)
    const parsedTotal = receipt.total == null
      ? parsedSubtotal +
        Math.round((receipt.tax ?? 0) * 100) +
        Math.round((receipt.tip ?? 0) * 100) +
        Math.round((receipt.other_fees ?? 0) * 100)
      : Math.round(receipt.total * 100)

    setSource('capture')
    setDescription(receipt.store_name?.trim() || 'Receipt')
    setStoreName(receipt.store_name ?? '')
    setStoreAddress(receipt.store_address ?? '')
    setReceiptNumber(receipt.receipt_number ?? '')
    setReceiptDate(receipt.date ?? '')
    setReceiptTime(receipt.time ?? '')
    setPaymentMethod(receipt.payment_method ?? '')
    setCardLast4(receipt.card_last_4 ?? '')
    setItemCount(receipt.item_count == null ? String(nextItems.length) : String(receipt.item_count))
    setItems(nextItems)
    setSubtotalAmount(moneyValue(parsedSubtotal))
    setTaxAmount(dollarsValue(receipt.tax))
    setTipAmount(dollarsValue(receipt.tip))
    setFeesAmount(dollarsValue(receipt.other_fees))
    setTotalAmount(moneyValue(parsedTotal))
    if (receipt.date) setIncurredDate(receipt.date.slice(0, 10))
    if (receipt.time) setIncurredTime(receipt.time.slice(0, 5))
    if (nextItems.length > 0) setContentMode('items')
    setSplitMode('equal')
    setReceiptNotice('Receipt details extracted. Review every field before saving.')
    touch()
  }

  async function runReceiptParse(file: File) {
    setReceiptFile(file)
    setReceiptError(null)
    setReceiptNotice(null)
    setIsParsingReceipt(true)
    try {
      applyParsedReceipt(await parseReceipt(file))
    } catch (requestError) {
      setReceiptError(apiErrorMessage(requestError, 'Unable to read this receipt. Enter it manually or try another image.'))
    } finally {
      setIsParsingReceipt(false)
    }
  }

  function selectReceiptFile(file: File | undefined) {
    if (!file) return
    setReceiptError(null)
    if (!file.type.startsWith('image/')) {
      setReceiptError('Choose an image file such as JPG, PNG, HEIC, or WebP.')
      return
    }
    if (file.size > MAX_RECEIPT_IMAGE_BYTES) {
      setReceiptError('Receipt images must be 10 MiB or smaller.')
      return
    }
    if (!hasReceiptConsent) {
      setPendingConsentFile(file)
      consentDialogFocus.capture()
      setShowConsent(true)
      return
    }
    void runReceiptParse(file)
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setIsDragging(false)
    selectReceiptFile(event.dataTransfer.files[0])
  }

  async function acceptReceiptConsent() {
    if (!pendingConsentFile) return
    setIsSavingConsent(true)
    setReceiptError(null)
    try {
      const updatedUser = await recordAiReceiptConsent()
      auth.replaceUser(updatedUser)
      setHasReceiptConsent(true)
      setShowConsent(false)
      const file = pendingConsentFile
      setPendingConsentFile(null)
      await runReceiptParse(file)
    } catch (requestError) {
      setReceiptError(apiErrorMessage(requestError, 'Unable to save receipt-processing consent.'))
    } finally {
      setIsSavingConsent(false)
    }
  }

  function validLineItems(): { inputs: BillLineItemInput[]; error: string | null } {
    const shouldSendItems = contentMode === 'items' || preservedSupportingItems
    if (!shouldSendItems) return { inputs: [], error: null }
    if (items.length === 0) return { inputs: [], error: 'Add at least one line item.' }

    const inputs: BillLineItemInput[] = []
    for (const [index, item] of items.entries()) {
      const quantity = Number(item.quantity)
      const unitPriceCents = parseAmountToCents(item.unitPrice)
      const totalPriceCents = parseAmountToCents(item.totalPrice)
      if (!item.name.trim()) return { inputs: [], error: `Name item ${index + 1}.` }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return { inputs: [], error: `Enter a valid quantity for ${item.name}.` }
      }
      if (unitPriceCents == null || totalPriceCents == null || totalPriceCents <= 0) {
        return { inputs: [], error: `Enter a valid price for ${item.name}.` }
      }
      inputs.push({
        name: item.name.trim(),
        quantity,
        unitPriceCents,
        totalPriceCents,
        assignedUserIds: splitMode === 'items' ? item.assignedUserIds : [],
      })
    }
    return { inputs, error: null }
  }

  function buildPayload(): { input: BillInput | null; error: string | null } {
    if (!currentUser) return { input: null, error: 'Your account is still loading.' }
    if (!description.trim()) return { input: null, error: 'Enter a bill title.' }
    if (!incurredDate) return { input: null, error: 'Choose the bill date.' }
    if (totalCents == null || totalCents <= 0) {
      return { input: null, error: 'Enter a final total greater than zero.' }
    }
    if (target === 'friends' && selectedFriendIds.length === 0) {
      return { input: null, error: 'Choose at least one person to split with.' }
    }
    if (
      target === 'group' &&
      ((!selectedGroupId && !isHistoricalDeletedGroup) || participantIds.length < 2)
    ) {
      return { input: null, error: groupError ?? 'Choose a group with at least two members.' }
    }
    if (!participantIds.includes(activePayerId)) {
      return { input: null, error: 'Choose a payer from the bill participants.' }
    }

    const lineItemResult = validLineItems()
    if (lineItemResult.error) return { input: null, error: lineItemResult.error }
    const parsedItemCount = itemCount.trim() ? Number(itemCount) : null
    if (parsedItemCount != null && (!Number.isInteger(parsedItemCount) || parsedItemCount < 0)) {
      return { input: null, error: 'Item count must be a whole number.' }
    }

    let shares: BillInput['shares']
    if (target !== 'group') {
      if (target === 'solo' || splitMode === 'equal') {
        shares = equalShareCents(totalCents, participantIds, activePayerId).map((share) => ({
          ...share,
          lenderId: activePayerId,
        }))
      } else if (splitMode === 'items') {
        const allocated = allocateItemizedShares({
          totalCents,
          payerId: activePayerId,
          participantIds,
          lineItems: lineItemResult.inputs,
        })
        if (allocated.error) return { input: null, error: allocated.error }
        shares = allocated.shares.map((share) => ({ ...share, lenderId: activePayerId }))
      } else {
        const nonPayerShares = participantIds
          .filter((userId) => userId !== activePayerId)
          .map((userId) => ({ userId, shareCents: parseAmountToCents(customAmounts[userId] ?? '') }))
        const invalid = nonPayerShares.find((share) => share.shareCents == null)
        if (invalid) {
          return {
            input: null,
            error: `Enter an amount for ${displayName(peopleById.get(invalid.userId))}.`,
          }
        }
        const assigned = nonPayerShares.reduce((sum, share) => sum + (share.shareCents ?? 0), 0)
        if (assigned > totalCents) {
          return { input: null, error: 'Participant amounts cannot exceed the bill total.' }
        }
        shares = [
          ...nonPayerShares.map((share) => ({
            userId: share.userId,
            shareCents: share.shareCents ?? 0,
            lenderId: activePayerId,
          })),
          { userId: activePayerId, shareCents: totalCents - assigned, lenderId: activePayerId },
        ]
      }
    }

    return {
      input: {
        description: description.trim(),
        incurredAt: toIncurredAt(incurredDate, incurredTime),
        totalCents,
        payerId: activePayerId,
        source,
        isOneMainTotal: contentMode === 'total',
        isSplitWithFriends: target !== 'solo',
        isSplitWithGroup: target === 'group',
        groupId: target === 'group' ? selectedGroupId || null : null,
        isSplitByFinalAmounts: splitMode !== 'items',
        participantIds,
        storeName: nullable(storeName),
        storeAddress: nullable(storeAddress),
        receiptNumber: nullable(receiptNumber),
        receiptDate: nullable(receiptDate),
        receiptTime: nullable(receiptTime),
        paymentMethod: nullable(paymentMethod),
        cardLast4: nullable(cardLast4),
        itemCount: parsedItemCount ?? (lineItemResult.inputs.length > 0 ? lineItemResult.inputs.length : null),
        subtotalCents:
          parseAmountToCents(subtotalAmount) ??
          (lineItemResult.inputs.length > 0 ? computedSubtotalCents : null),
        otherFeesCents: parseAmountToCents(feesAmount),
        taxCents: parseAmountToCents(taxAmount),
        tipCents: parseAmountToCents(tipAmount),
        lineItems: lineItemResult.inputs,
        ...(shares ? { shares } : {}),
      },
      error: null,
    }
  }

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = buildPayload()
    if (result.error) {
      setError(result.error)
      return
    }
    if (!isReviewing) {
      setIsReviewing(true)
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      })
      return
    }
    void save(result.input!)
  }

  async function save(input: BillInput) {
    setError(null)
    setIsSaving(true)
    try {
      const saved = bill ? await updateBill(bill.id, input) : await createBill(input)
      allowNavigationRef.current = true
      setIsDirty(false)
      void invalidateBillData()
      onSaved(saved)
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to save this bill.'))
      setIsReviewing(false)
    } finally {
      setIsSaving(false)
    }
  }

  function cancel() {
    captureNavigationDialogFocus()
    onCancel()
  }

  if (!currentUser) return <p className="screen-message">Loading your account…</p>

  const payerRemainder = totalCents == null
    ? null
    : totalCents - participantIds
        .filter((userId) => userId !== activePayerId)
        .reduce((sum, userId) => sum + (parseAmountToCents(customAmounts[userId] ?? '') ?? 0), 0)

  return (
    <form className="bc-composer" onSubmit={review}>
      <div className="bc-composer-progress" aria-label="Bill creation progress">
        <span aria-current={!isReviewing ? 'step' : undefined} className={!isReviewing ? 'is-active' : 'is-complete'}>1 <b>Details</b></span>
        <span aria-current={isReviewing ? 'step' : undefined} className={isReviewing ? 'is-active' : ''}>2 <b>Review</b></span>
      </div>

      {isReviewing ? (
        <section className="bc-review" aria-labelledby="bill-review-heading">
          <div className="bc-section-heading">
            <div>
              <p className="eyebrow">Check before saving</p>
              <h2 id="bill-review-heading" ref={reviewHeadingRef} tabIndex={-1}>Review your bill</h2>
            </div>
            <button className="quiet-button" onClick={() => setIsReviewing(false)} type="button">
              Edit details
            </button>
          </div>
          <div className="bc-review-hero">
            <div>
              <span>{source === 'capture' ? 'Captured receipt' : 'Manual entry'}</span>
              <h3>{description}</h3>
              <p>{new Date(`${incurredDate}T00:00:00Z`).toLocaleDateString(undefined, { dateStyle: 'long', timeZone: 'UTC' })}</p>
            </div>
            <strong>{totalCents == null ? '—' : formatCad(totalCents)}</strong>
          </div>
          <dl className="bc-review-grid">
            <div><dt>Target</dt><dd>{target === 'solo' ? 'Just you' : target === 'group' ? groupDetail?.name ?? bill?.group?.name ?? (isHistoricalDeletedGroup ? 'Former group' : 'Group') : `${selectedFriendIds.length} friend${selectedFriendIds.length === 1 ? '' : 's'}`}</dd></div>
            <div><dt>Paid by</dt><dd>{displayName(peopleById.get(activePayerId))}</dd></div>
            <div><dt>Split</dt><dd>{target === 'group' || splitMode === 'equal' ? 'Evenly' : splitMode === 'items' ? 'By item' : 'Custom amounts'}</dd></div>
            <div><dt>Participants</dt><dd>{participants.map(displayName).join(', ')}</dd></div>
            <div><dt>Format</dt><dd>{contentMode === 'items' ? `${items.length} line item${items.length === 1 ? '' : 's'}` : 'One total'}</dd></div>
            <div><dt>Merchant</dt><dd>{storeName || 'Not provided'}</dd></div>
          </dl>
          {contentMode === 'items' ? (
            <div className="bc-review-items">
              {items.map((item) => (
                <div key={item.key}><span>{item.quantity} × {item.name}</span><strong>{formatCad(lineTotalCents(item) ?? 0)}</strong></div>
              ))}
            </div>
          ) : null}
        </section>
      ) : (
        <div className="bc-composer-grid">
          <div className="bc-composer-main">
            {!bill ? (
              <section className="bc-card bc-upload-card">
                <div className="bc-section-heading">
                  <div><p className="eyebrow">Optional shortcut</p><h2>Start from a receipt</h2></div>
                  {source === 'capture' ? <span className="bc-status success">Receipt imported</span> : null}
                </div>
                <label
                  className={`bc-dropzone${isDragging ? ' is-dragging' : ''}`}
                  onDragEnter={(event) => { event.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleDrop}
                >
                  <input
                    accept="image/*"
                    disabled={isParsingReceipt}
                    type="file"
                    onChange={(event) => selectReceiptFile(event.target.files?.[0])}
                  />
                  <span className="bc-upload-icon" aria-hidden="true">↥</span>
                  <strong>{isParsingReceipt ? 'Reading your receipt…' : receiptFile ? 'Replace receipt image' : 'Drop a receipt image here'}</strong>
                  <small>{isParsingReceipt ? 'This can take up to a minute.' : 'or choose a JPG, PNG, HEIC, or WebP up to 10 MiB'}</small>
                </label>
                <p className="bc-privacy-note">Your image is processed with Google Gemini to extract fields and is not retained by BillCompass.</p>
                {receiptError ? <div className="bc-inline-error" role="alert"><span>{receiptError}</span>{receiptFile ? <button type="button" onClick={() => void runReceiptParse(receiptFile)}>Try again</button> : null}</div> : null}
                {receiptNotice ? <p className="bc-inline-success" role="status">{receiptNotice}</p> : null}
              </section>
            ) : null}

            <section className="bc-card">
              <div className="bc-section-heading"><div><p className="eyebrow">Bill details</p><h2>What was paid?</h2></div></div>
              <div className="bc-field-grid">
                <label className="bc-field bc-field-wide">Title<input maxLength={120} required value={description} onChange={(event) => { touch(); setDescription(event.target.value) }} placeholder="Dinner, groceries, weekend rental…" /></label>
                <label className="bc-field">Date<input required type="date" value={incurredDate} onChange={(event) => { touch(); setIncurredDate(event.target.value) }} /></label>
                <label className="bc-field">Time <span>(optional)</span><input type="time" value={incurredTime} onChange={(event) => { touch(); setIncurredTime(event.target.value) }} /></label>
              </div>
              <fieldset className="bc-choice-fieldset">
                <legend>Bill format</legend>
                <div className="bc-segments">
                  <button aria-pressed={contentMode === 'total'} className={contentMode === 'total' ? 'is-active' : ''} type="button" onClick={() => chooseContentMode('total')}><strong>One total</strong><span>Enter a single final amount</span></button>
                  <button aria-pressed={contentMode === 'items'} className={contentMode === 'items' ? 'is-active' : ''} type="button" onClick={() => chooseContentMode('items')}><strong>Itemized</strong><span>Add receipt lines and adjustments</span></button>
                </div>
              </fieldset>

              {contentMode === 'total' ? (
                <div className="bc-total-field">
                  <label>Final total (CAD)<span><b>$</b><input inputMode="decimal" min="0.01" required step="0.01" type="number" value={totalAmount} onChange={(event) => { touch(); setTotalAmount(event.target.value) }} placeholder="0.00" /></span></label>
                  {preservedSupportingItems ? <p>{bill?.lineItems.length} captured receipt items will be preserved with this bill.</p> : null}
                </div>
              ) : (
                <div className="bc-items-editor">
                  <div className="bc-items-head"><h3>Line items</h3><button className="text-button" type="button" onClick={addItem}>+ Add item</button></div>
                  {items.map((item, index) => (
                    <article className="bc-item-row" key={item.key}>
                      <div className="bc-item-number">{index + 1}</div>
                      <label className="bc-field bc-item-name">Item<input value={item.name} onChange={(event) => updateItem(item.key, { name: event.target.value })} placeholder="Item name" /></label>
                      <label className="bc-field">Qty<input inputMode="decimal" min="0.01" step="0.01" type="number" value={item.quantity} onChange={(event) => updateItem(item.key, { quantity: event.target.value }, true)} /></label>
                      <label className="bc-field">Unit price<input inputMode="decimal" min="0" step="0.01" type="number" value={item.unitPrice} onChange={(event) => updateItem(item.key, { unitPrice: event.target.value }, true)} /></label>
                      <label className="bc-field">Line total<input inputMode="decimal" min="0" step="0.01" type="number" value={item.totalPrice} onChange={(event) => updateItem(item.key, { totalPrice: event.target.value })} /></label>
                      <button aria-label={`Remove ${item.name || `item ${index + 1}`}`} className="bc-remove-item" type="button" onClick={(event) => removeItem(item.key, event.currentTarget)}>×</button>
                      {splitMode === 'items' ? (
                        <div className="bc-item-assignments">
                          <span>Assign to</span>
                          {participants.map((participant) => (
                            <label key={participant.id}><input checked={item.assignedUserIds.includes(participant.id)} type="checkbox" onChange={() => toggleAssignment(item.key, participant.id)} />{displayName(participant)}</label>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))}
                  <div className="bc-adjustment-grid">
                    <label className="bc-field">Subtotal<input inputMode="decimal" min="0" step="0.01" type="number" value={subtotalAmount} onChange={(event) => { touch(); setSubtotalAmount(event.target.value) }} /></label>
                    <label className="bc-field">Tax<input inputMode="decimal" min="0" step="0.01" type="number" value={taxAmount} onChange={(event) => { touch(); setTaxAmount(event.target.value) }} /></label>
                    <label className="bc-field">Tip<input inputMode="decimal" min="0" step="0.01" type="number" value={tipAmount} onChange={(event) => { touch(); setTipAmount(event.target.value) }} /></label>
                    <label className="bc-field">Other fees<input inputMode="decimal" min="0" step="0.01" type="number" value={feesAmount} onChange={(event) => { touch(); setFeesAmount(event.target.value) }} /></label>
                  </div>
                  <div className="bc-items-summary"><span>Items currently add to {formatCad(computedSubtotalCents)}</span><label>Final receipt total <b>$</b><input inputMode="decimal" min="0.01" required step="0.01" type="number" value={totalAmount} onChange={(event) => { touch(); setTotalAmount(event.target.value) }} /></label></div>
                </div>
              )}

              <details className="bc-details" open={source === 'capture' || Boolean(storeName || receiptNumber)}>
                <summary>Receipt and payment details <span>Optional</span></summary>
                <div className="bc-field-grid">
                  <label className="bc-field">Store name<input value={storeName} onChange={(event) => { touch(); setStoreName(event.target.value) }} /></label>
                  <label className="bc-field">Receipt number<input value={receiptNumber} onChange={(event) => { touch(); setReceiptNumber(event.target.value) }} /></label>
                  <label className="bc-field bc-field-wide">Store address<input value={storeAddress} onChange={(event) => { touch(); setStoreAddress(event.target.value) }} /></label>
                  <label className="bc-field">Receipt date<input type="date" value={receiptDate} onChange={(event) => { touch(); setReceiptDate(event.target.value) }} /></label>
                  <label className="bc-field">Receipt time<input type="time" value={receiptTime} onChange={(event) => { touch(); setReceiptTime(event.target.value) }} /></label>
                  <label className="bc-field">Payment method<input value={paymentMethod} onChange={(event) => { touch(); setPaymentMethod(event.target.value) }} placeholder="Visa, cash…" /></label>
                  <label className="bc-field">Card last 4<input inputMode="numeric" maxLength={4} value={cardLast4} onChange={(event) => { touch(); setCardLast4(event.target.value.replace(/\D/g, '').slice(0, 4)) }} /></label>
                  <label className="bc-field">Item count<input inputMode="numeric" min="0" step="1" type="number" value={itemCount} onChange={(event) => { touch(); setItemCount(event.target.value) }} /></label>
                </div>
              </details>
            </section>
          </div>

          <aside className="bc-composer-aside">
            <section className="bc-card bc-sticky-card">
              <div className="bc-section-heading"><div><p className="eyebrow">People</p><h2>Who is this for?</h2></div></div>
              <fieldset className="bc-choice-fieldset">
                <legend>Split target</legend>
                <div className="bc-target-grid">
                  <button aria-pressed={target === 'solo'} className={target === 'solo' ? 'is-active' : ''} disabled={retargetLocked} type="button" onClick={() => chooseTarget('solo')}><span aria-hidden="true">●</span><strong>Just me</strong></button>
                  <button aria-pressed={target === 'friends'} className={target === 'friends' ? 'is-active' : ''} disabled={retargetLocked || (friends.length === 0 && historicalFriendParticipants.length === 0)} type="button" onClick={() => chooseTarget('friends')}><span aria-hidden="true">●●</span><strong>Friends</strong></button>
                  <button aria-pressed={target === 'group'} className={target === 'group' ? 'is-active' : ''} disabled={retargetLocked || groups.length === 0} type="button" onClick={() => chooseTarget('group')}><span aria-hidden="true">●●●</span><strong>Group</strong></button>
                </div>
                {retargetLocked ? <p className="bc-lock-note">Only the bill creator can change its target, participants, or payer.</p> : null}
              </fieldset>

              {target === 'friends' ? (
                <div className="bc-person-picker">
                  <h3>Choose friends</h3>
                  {friends.length === 0 && historicalFriendParticipants.length === 0 ? <p className="empty-state">Accept a friend invitation to split this bill.</p> : friends.map((friendship) => (
                    <label key={friendship.id}><input checked={selectedFriendIds.includes(friendship.friend.id)} disabled={retargetLocked} type="checkbox" onChange={() => toggleFriend(friendship.friend.id)} /><span className="bc-avatar">{displayName(friendship.friend).slice(0, 1).toUpperCase()}</span><span><strong>{displayName(friendship.friend)}</strong><small>{friendship.friend.email}</small></span></label>
                  ))}
                  {historicalFriendParticipants.map((participant) => (
                    <label key={participant.id}><input checked disabled={retargetLocked} type="checkbox" onChange={() => toggleFriend(participant.id)} /><span className="bc-avatar">{displayName(participant).slice(0, 1).toUpperCase()}</span><span><strong>{displayName(participant)}</strong><small>Historical participant · no longer in People</small></span></label>
                  ))}
                </div>
              ) : null}

              {target === 'group' ? (
                <div className="bc-group-picker">
                  <label className="bc-field">Group<select disabled={retargetLocked} value={selectedGroupId} onChange={(event) => { touch(); setIsLoadingGroup(true); setGroupDetail(null); setSelectedGroupId(event.target.value) }}>{isHistoricalDeletedGroup ? <option value="">Former group · historical members</option> : null}{bill?.group && !groups.some((group) => group.id === bill.group?.id) ? <option value={bill.group.id}>{bill.group.name} · historical members</option> : null}{groups.map((group) => <option key={group.id} value={group.id}>{group.name} · {group.memberCount} members</option>)}</select></label>
                  {isLoadingGroup ? <p className="bc-loading-line">Loading members…</p> : null}
                  {groupError ? <p className="form-error">{groupError}</p> : null}
                  {bill?.isSplitWithGroup && (bill.groupId ?? '') === selectedGroupId ? <p className="bc-group-note">This bill keeps its original participant snapshot. Membership changes affect future bills only.</p> : groupDetail ? <p className="bc-group-note">Every current member is included. Group bills are split evenly.</p> : null}
                </div>
              ) : null}

              {participants.length > 0 ? (
                <label className="bc-field bc-payer-field">Paid by<select disabled={retargetLocked || target === 'solo'} value={activePayerId} onChange={(event) => { touch(); setPayerId(event.target.value) }}>{participants.map((participant) => <option key={participant.id} value={participant.id}>{displayName(participant)}</option>)}</select></label>
              ) : null}

              {target !== 'solo' && participants.length > 1 ? (
                <fieldset className="bc-choice-fieldset bc-split-method">
                  <legend>How should it be split?</legend>
                  <div className="bc-split-options">
                    <button aria-pressed={splitMode === 'equal'} className={splitMode === 'equal' ? 'is-active' : ''} type="button" onClick={() => { touch(); setSplitMode('equal') }}><span>Evenly</span><small>Equal shares, down to the cent</small></button>
                    {target !== 'group' ? <button aria-pressed={splitMode === 'custom'} className={splitMode === 'custom' ? 'is-active' : ''} type="button" onClick={() => { touch(); setSplitMode('custom') }}><span>Custom amounts</span><small>The payer covers any remainder</small></button> : null}
                    {target !== 'group' && contentMode === 'items' ? <button aria-pressed={splitMode === 'items'} className={splitMode === 'items' ? 'is-active' : ''} type="button" onClick={() => { touch(); setSplitMode('items') }}><span>By line item</span><small>Assign each item to people</small></button> : null}
                  </div>
                </fieldset>
              ) : null}

              {target === 'friends' && splitMode === 'custom' ? (
                <div className="bc-custom-split">
                  <h3>Final amounts</h3>
                  {participants.map((participant) => {
                    const isPayer = participant.id === activePayerId
                    return <label key={participant.id}><span>{displayName(participant)}{isPayer ? <small>Payer · remainder</small> : null}</span><b>$</b><input disabled={isPayer} inputMode="decimal" min="0" step="0.01" value={isPayer ? moneyValue(Math.max(0, payerRemainder ?? 0)) : customAmounts[participant.id] ?? ''} onChange={(event) => { touch(); setCustomAmounts((current) => ({ ...current, [participant.id]: event.target.value })) }} /></label>
                  })}
                  {payerRemainder != null && payerRemainder < 0 ? <p className="form-error">Participant amounts exceed the total.</p> : null}
                </div>
              ) : null}

              <div className="bc-participant-summary">
                <span>{participants.length} participant{participants.length === 1 ? '' : 's'}</span>
                <strong>{totalCents == null ? '$0.00' : formatCad(totalCents)}</strong>
              </div>
            </section>
          </aside>
        </div>
      )}

      {error ? <p className="bc-save-error" role="alert">{error}</p> : null}
      <div className="bc-composer-actions">
        <button className="quiet-button" disabled={isSaving} type="button" onClick={cancel}>Cancel</button>
        <button className="primary-button compact" disabled={isSaving || isParsingReceipt || isLoadingGroup} type="submit">{isSaving ? 'Saving…' : isReviewing ? bill ? 'Save changes' : 'Create bill' : 'Review bill'}</button>
      </div>

      <Dialog.Root
        open={showConsent}
        onOpenChange={(open) => {
          if (isSavingConsent) return
          setShowConsent(open)
          if (!open) setPendingConsentFile(null)
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="bc-consent-backdrop" />
          <Dialog.Content aria-describedby="receipt-consent-description" className="bc-consent-dialog" onCloseAutoFocus={consentDialogFocus.restore}>
            <span className="bc-consent-mark" aria-hidden="true">✦</span>
            <p className="eyebrow">Before we scan</p>
            <Dialog.Title>AI receipt processing</Dialog.Title>
            <Dialog.Description id="receipt-consent-description">BillCompass sends this receipt image to Google Gemini to extract merchant, item, and total details. The image is processed for this request and is not retained by BillCompass.</Dialog.Description>
            <p>You will always review and edit the extracted fields before anything is saved.</p>
            {receiptError ? <div className="bc-inline-error" role="alert">{receiptError}</div> : null}
            <div className="bc-consent-actions">
              <Dialog.Close asChild><button className="quiet-button" disabled={isSavingConsent} type="button">Not now</button></Dialog.Close>
              <button className="primary-button compact" disabled={isSavingConsent} type="button" onClick={() => void acceptReceiptConsent()}>{isSavingConsent ? 'Saving…' : 'Agree and scan'}</button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <AlertDialog.Root
        open={navigationBlocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && navigationBlocker.state === 'blocked') navigationBlocker.reset()
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="modal-backdrop" />
          <AlertDialog.Content className="modal-card" onCloseAutoFocus={restoreNavigationDialogFocus}>
            <AlertDialog.Title>Discard unsaved bill changes?</AlertDialog.Title>
            <AlertDialog.Description>
              Your bill has edits that have not been saved. Staying here keeps everything in the composer.
            </AlertDialog.Description>
            <div className="bc-dialog-actions">
              <AlertDialog.Cancel asChild>
                <button className="bc-button" type="button">Keep editing</button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  className="bc-button bc-button--danger"
                  onClick={() => {
                    if (navigationBlocker.state === 'blocked') {
                      allowNavigationRef.current = true
                      navigationBlocker.proceed()
                    }
                  }}
                  type="button"
                >
                  Discard changes
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </form>
  )
}
