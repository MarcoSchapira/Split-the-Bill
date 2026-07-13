import { z } from "zod";

export const GROUP_ICON_KEYS = [
  "home",
  "trip",
  "food",
  "groceries",
  "rent",
  "utilities",
  "entertainment",
  "sports",
  "pets",
  "family",
  "work",
  "other",
] as const;

export type GroupIconKey = (typeof GROUP_ICON_KEYS)[number];

export const groupIconKeySchema = z.enum(GROUP_ICON_KEYS);

export const DEFAULT_GROUP_ICON_KEY: GroupIconKey = "other";

export function isGroupIconKey(value: string): value is GroupIconKey {
  return (GROUP_ICON_KEYS as readonly string[]).includes(value);
}
