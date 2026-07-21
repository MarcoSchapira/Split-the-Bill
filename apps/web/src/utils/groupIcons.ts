import {
  BriefcaseBusiness,
  Building2,
  Clapperboard,
  Dumbbell,
  Home,
  PawPrint,
  Plane,
  Shapes,
  ShoppingBasket,
  Utensils,
  UsersRound,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { GroupIconKey } from '../api/types'

export const groupIconOptions: Array<{
  key: GroupIconKey;
  label: string;
  icon: LucideIcon;
}> = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'trip', label: 'Trip', icon: Plane },
  { key: 'food', label: 'Dining', icon: Utensils },
  { key: 'groceries', label: 'Groceries', icon: ShoppingBasket },
  { key: 'rent', label: 'Rent', icon: Building2 },
  { key: 'utilities', label: 'Utilities', icon: Zap },
  { key: 'entertainment', label: 'Entertainment', icon: Clapperboard },
  { key: 'sports', label: 'Sports', icon: Dumbbell },
  { key: 'pets', label: 'Pets', icon: PawPrint },
  { key: 'family', label: 'Family', icon: UsersRound },
  { key: 'work', label: 'Work', icon: BriefcaseBusiness },
  { key: 'other', label: 'Other', icon: Shapes },
]

export function groupIcon(key: GroupIconKey): LucideIcon {
  return groupIconOptions.find((option) => option.key === key)?.icon ?? Shapes
}

export function groupIconLabel(key: GroupIconKey): string {
  return groupIconOptions.find((option) => option.key === key)?.label ?? 'Other'
}
