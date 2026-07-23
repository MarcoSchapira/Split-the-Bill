import type { LucideIcon } from 'lucide-react'
import {
  Camera,
  ChartPie,
  CheckCircle2,
  CreditCard,
  Divide,
  FolderOpen,
  HandCoins,
  Layers,
  Receipt,
  ScanLine,
  Smartphone,
  Users,
  Wallet,
} from 'lucide-react'

export type LandingFeature = {
  icon: LucideIcon
  title: string
  description: string
  imageLabel: string
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

export const landingFeatures: LandingFeature[] = [
  {
    icon: ScanLine,
    title: 'Scan receipts automatically',
    description:
      'Turn a receipt photo into a structured bill with line items, tax, tip, and totals — ready to split immediately.',
    imageLabel: 'Receipt scan preview',
  },
  {
    icon: Divide,
    title: 'Split by individual items',
    description:
      'Assign meals, drinks, and purchases to the right people, or share appetizers and household items between multiple friends.',
    imageLabel: 'Item assignment preview',
  },
  {
    icon: HandCoins,
    title: 'Split by exact amounts',
    description:
      'When everyone owes something different, enter custom shares or divide the total evenly with just a few taps.',
    imageLabel: 'Custom split preview',
  },
  {
    icon: Wallet,
    title: 'See who owes who',
    description:
      'View what you owe, what you are owed, and your net balance from one clear dashboard across every shared expense.',
    imageLabel: 'Balance overview preview',
  },
  {
    icon: CreditCard,
    title: 'Track payments',
    description:
      'Know who has paid, who still owes money, and how much remains outstanding — then confirm payments as they arrive.',
    imageLabel: 'Payment tracking preview',
  },
  {
    icon: Users,
    title: 'Create groups for ongoing expenses',
    description:
      'Manage roommates, couples, families, and travel groups with shared balances that stay organized over time.',
    imageLabel: 'Groups preview',
  },
  {
    icon: Receipt,
    title: 'Store complete receipt details',
    description:
      'Keep item names, quantities, prices, merchant information, and receipt metadata together with every bill.',
    imageLabel: 'Receipt details preview',
  },
  {
    icon: FolderOpen,
    title: 'Organize every bill in one place',
    description:
      'Restaurant tabs, groceries, rent, trips, and shared purchases live in one calm list instead of scattered notes.',
    imageLabel: 'Bill list preview',
  },
  {
    icon: Smartphone,
    title: 'Stay synced across devices',
    description:
      'Use BillCompass on web and mobile with friends so balances stay up to date wherever you split expenses.',
    imageLabel: 'Cross-device sync preview',
  },
]

export const whyChooseItems: LandingWhyItem[] = [
  {
    icon: Camera,
    title: 'Less math, fewer awkward conversations',
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
