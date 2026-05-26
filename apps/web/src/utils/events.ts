export const DATA_CHANGED_EVENT = 'equisplit:data-changed'

export function notifyDataChanged(): void {
  window.dispatchEvent(new Event(DATA_CHANGED_EVENT))
}
