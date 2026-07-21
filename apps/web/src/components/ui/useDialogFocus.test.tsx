import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDialogFocus } from './useDialogFocus'

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

function runAnimationFramesImmediately() {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
}

describe('useDialogFocus', () => {
  it('restores focus to the control that opened a controlled dialog', () => {
    runAnimationFramesImmediately()
    const opener = document.createElement('button')
    const insideDialog = document.createElement('button')
    document.body.append(opener, insideDialog)
    opener.focus()
    const { result } = renderHook(() => useDialogFocus())

    act(() => result.current.capture())
    insideDialog.focus()
    act(() => result.current.restore(new Event('close', { cancelable: true })))

    expect(document.activeElement).toBe(opener)
  })

  it('focuses the page heading when a mutation removes the opener', () => {
    runAnimationFramesImmediately()
    const main = document.createElement('main')
    main.id = 'main-content'
    const heading = document.createElement('h1')
    main.append(heading)
    const opener = document.createElement('button')
    document.body.append(main, opener)
    opener.focus()
    const { result } = renderHook(() => useDialogFocus())

    act(() => result.current.capture())
    opener.remove()
    act(() => result.current.restore(new Event('close', { cancelable: true })))

    expect(document.activeElement).toBe(heading)
    expect(heading).toHaveAttribute('tabindex', '-1')
  })
})
