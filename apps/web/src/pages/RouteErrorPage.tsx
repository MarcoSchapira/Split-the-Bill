import { useEffect, useState } from 'react'
import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom'

const CHUNK_RELOAD_KEY = 'bc-chunk-reload'

function errorMessage(error: unknown): string {
  if (isRouteErrorResponse(error)) {
    return error.statusText || String(error.status)
  }
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Unknown error'
}

function isChunkLoadError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('failed to fetch dynamically imported module') ||
    normalized.includes('importing a module script failed') ||
    normalized.includes('error loading dynamically imported module')
  )
}

export function RouteErrorPage() {
  const error = useRouteError()
  const message = errorMessage(error)
  const chunkError = isChunkLoadError(message)
  const [autoReloading, setAutoReloading] = useState(false)

  useEffect(() => {
    if (!chunkError) return
    try {
      if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return
      sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
      setAutoReloading(true)
      window.location.reload()
    } catch {
      // sessionStorage may be unavailable; fall through to the recovery UI
    }
  }, [chunkError])

  useEffect(() => {
    document.title = 'Something went wrong — BillCompass'
  }, [])

  const headline = chunkError ? 'This page needs a refresh' : 'Something went wrong'
  const support = chunkError
    ? 'A newer version of BillCompass is available. Reload to continue where you left off.'
    : 'We hit an unexpected issue loading this page. Reloading usually clears it up.'

  if (autoReloading) {
    return (
      <div className="route-error" role="status" aria-live="polite">
        <Link className="route-error__brand" to="/" aria-label="BillCompass home">
          <img
            alt=""
            aria-hidden="true"
            className="route-error__logo"
            height={48}
            src="/equishare_logo_mobile.png"
            width={48}
          />
          <strong className="route-error__brand-name">BillCompass</strong>
        </Link>
        <main className="route-error__main">
          <p className="route-error__eyebrow">Updating</p>
          <h1 className="route-error__title">Refreshing BillCompass…</h1>
          <p className="route-error__copy">Hang tight — loading the latest version.</p>
        </main>
      </div>
    )
  }

  return (
    <div className="route-error">
      <Link className="route-error__brand" to="/" aria-label="BillCompass home">
        <img
          alt=""
          aria-hidden="true"
          className="route-error__logo"
          height={48}
          src="/equishare_logo_mobile.png"
          width={48}
        />
        <strong className="route-error__brand-name">BillCompass</strong>
      </Link>

      <main className="route-error__main">
        <p className="route-error__eyebrow">{chunkError ? 'Update available' : 'Error'}</p>
        <h1 className="route-error__title">{headline}</h1>
        <p className="route-error__copy">{support}</p>

        <div className="route-error__actions">
          <button
            className="route-error__reload"
            type="button"
            onClick={() => window.location.reload()}
          >
            Reload Page
          </button>
          {!chunkError ? (
            <Link className="route-error__home-link" to="/">
              Go to BillCompass home
            </Link>
          ) : null}
        </div>

        {import.meta.env.DEV ? (
          <details className="route-error__details">
            <summary>Technical details</summary>
            <pre>{message}</pre>
          </details>
        ) : null}
      </main>
    </div>
  )
}
