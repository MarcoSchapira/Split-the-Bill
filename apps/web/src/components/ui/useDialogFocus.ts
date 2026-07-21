import { useCallback, useRef } from 'react'

export function useDialogFocus() {
  const openerRef = useRef<HTMLElement | null>(null)

  const capture = useCallback(() => {
    openerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
  }, [])

  const restore = useCallback((event: Event) => {
    event.preventDefault()
    const opener = openerRef.current
    window.requestAnimationFrame(() => {
      if (opener?.isConnected) {
        opener.focus()
        return
      }

      const fallback = document.querySelector<HTMLElement>('#main-content h1, #main-content h2')
        ?? document.getElementById('main-content')
      if (fallback) {
        if (!fallback.hasAttribute('tabindex')) fallback.tabIndex = -1
        fallback.focus()
      }
    })
  }, [])

  return { capture, restore }
}
