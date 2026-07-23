import type { LucideIcon } from 'lucide-react'
import {
  Camera,
  ChartPie,
  CheckCircle2,
  Divide,
  HandCoins,
  Layers,
  Receipt,
  ScanLine,
  Users,
} from 'lucide-react'

export type LandingShowcaseFeature = {
  id: string
  icon: LucideIcon
  title: string
  description: string
  bullets: string[]
  image?: string
  imageAlt: string
  previewLabel: string
}

export type LandingWhyItem = {
  icon: LucideIcon
  title: string
  description: string
}

export type LandingFaqItem = {
  question: string
  answer: string
}

export const howItWorksSteps = [
  {
    step: 1,
    title: 'Snap a receipt',
    description:
      'Take a photo, import from your library, or enter a bill manually. BillCompass turns it into a ready-to-split expense in seconds.',
  },
  {
    step: 2,
    title: 'Choose friends or a group',
    description:
      'Assign items to the people who ordered them, split evenly, or enter exact amounts for roommates, trips, and shared tabs.',
  },
  {
    step: 3,
    title: 'Track who owes what',
    description:
      'See balances update instantly, mark payments as received, and keep every shared bill organized in one synced place.',
  },
] as const

export const landingShowcaseFeatures: LandingShowcaseFeature[] = [
  {
    id: 'full-bill',
    icon: Receipt,
    title: 'Every detail of the bill, in one place',
    description:
      'Open any bill and review line items, each person’s share, payment status, tax, tip, and totals together — without jumping between screens.',
    bullets: [
      'See itemized receipt lines, quantities, and prices',
      'Review each person’s share and what they still owe',
      'Track who has paid and what remains outstanding',
    ],
    image: '/images/full-bill.png',
    imageAlt: 'BillCompass bill detail showing line items, shares, and payment status',
    previewLabel: 'Full bill view',
  },
  {
    id: 'requests',
    icon: HandCoins,
    title: 'See who owes who across every bill',
    description:
      'Your requests view brings outstanding balances into one place so you always know what needs attention and who still needs to pay.',
    bullets: [
      'Follow payment status on all your shared bills',
      'See what you owe and what friends owe you',
      'Keep balances current as payments are confirmed',
    ],
    image: '/images/requests.png',
    imageAlt: 'BillCompass requests screen showing who owes who',
    previewLabel: 'Requests & balances',
  },
  {
    id: 'groups',
    icon: Users,
    title: 'Groups for ongoing shared expenses',
    description:
      'Create groups for roommates, couples, trips, or friend circles and keep recurring costs organized with everyone on the same page.',
    bullets: [
      'Add members and split new expenses within a group',
      'Manage household, travel, and social tabs together',
      'See shared balances for everyone in the group',
    ],
    image: '/images/spain-group.png',
    imageAlt: 'BillCompass group view with members and shared bills',
    previewLabel: 'Group expenses',
  },
  {
    id: 'split-flexible',
    icon: Divide,
    title: 'Split by final amount or by individual items',
    description:
      'Choose the split that fits the moment — assign exact amounts when shares differ, or divide line items when everyone ordered something different.',
    bullets: [
      'Enter custom amounts for each person on a bill',
      'Divide the total evenly when that is the fair split',
      'Assign meals, drinks, and purchases to the right people',
    ],
    imageAlt: 'BillCompass split options for custom amounts and line items',
    previewLabel: 'Flexible splitting',
  },
  {
    id: 'receipt-scan',
    icon: ScanLine,
    title: 'Turn captured receipts into new bills automatically',
    description:
      'Take a photo or import from your library and BillCompass extracts line items, tax, tip, and totals into a bill that is ready to split.',
    bullets: [
      'Capture receipts with your phone camera on the go',
      'Import existing receipt images from your photo library',
      'Start splitting right away without retyping every item',
    ],
    imageAlt: 'BillCompass receipt capture converting a photo into a bill',
    previewLabel: 'Receipt scanning',
  },
]

export const whyChooseItems: LandingWhyItem[] = [
  {
    icon: Camera,
    title: 'Less math, more time',
    description:
      'Replace back-of-napkin calculations and payment reminders with a shared record everyone can trust.',
  },
  {
    icon: Layers,
    title: 'Flexible splitting for real life',
    description:
      'Split by item, by amount, or evenly — whether it is dinner with friends, rent with roommates, or a group trip.',
  },
  {
    icon: ChartPie,
    title: 'Balances that stay current',
    description:
      'Every bill update, payment confirmation, and group change reflects immediately so nobody has to guess who owes what.',
  },
  {
    icon: CheckCircle2,
    title: 'Built for clarity, not clutter',
    description:
      'A focused experience that keeps invitations, bills, activity, and balances easy to review without extra noise.',
  },
]

export const faqItems: LandingFaqItem[] = [
  {
    question: 'Is BillCompass really free?',
    answer:
      'Yes. BillCompass is fully free to use — create an account, split bills with friends, and track balances without a subscription or paywall.',
  },
  {
    question: 'How does receipt scanning work?',
    answer:
      'Take a photo of a receipt or import an image from your library. BillCompass extracts line items, totals, tax, and tip so you can assign costs to the right people right away.',
  },
  {
    question: 'Can I split a bill unevenly?',
    answer:
      'Absolutely. Assign individual receipt items, enter custom amounts for each person, or split the full total evenly — whichever matches the situation.',
  },
  {
    question: 'Does it work with groups and roommates?',
    answer:
      'Yes. Create groups for recurring shared expenses like rent, utilities, trips, or household costs, then add new bills directly to the group.',
  },
  {
    question: 'Will my friends need an account?',
    answer:
      'Friends join through invitations so everyone shares the same source of truth for balances, bills, and payment status.',
  },
  {
    question: 'Can I use BillCompass on my phone and on the web?',
    answer:
      'BillCompass syncs across web and mobile, so you can capture a receipt on your phone and review balances from any device.',
  },
]
