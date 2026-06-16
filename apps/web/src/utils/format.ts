export function formatCad(cents: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(cents / 100)
}

export function displayName(user: { name: string | null; email: string } | null | undefined): string {
  if (!user) {
    return 'Unknown user'
  }

  return user.name ?? user.email
}
