import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { LandingHeader } from '../components/LandingHeader'

type LegalDocumentPageProps = {
  title: string
  documentPath: string
}

export function LegalDocumentPage({ title, documentPath }: LegalDocumentPageProps) {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadDocument() {
      setContent(null)
      setError(null)

      try {
        const response = await fetch(documentPath)
        if (!response.ok) {
          throw new Error(`Failed to load document (${response.status})`)
        }
        const text = await response.text()
        // Page already shows the document title; skip the file's leading H1.
        const body = text.replace(/^#\s+[^\n]+\n+/, '')
        if (!cancelled) {
          setContent(body)
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load this document. Please try again later.')
        }
      }
    }

    void loadDocument()

    return () => {
      cancelled = true
    }
  }, [documentPath])

  return (
    <main className="landing-page legal-page">
      <LandingHeader minimal />

      <section className="legal-document">
        <h1 className="legal-document-title">{title}</h1>

        {error ? (
          <p className="legal-document-status">{error}</p>
        ) : content === null ? (
          <p className="legal-document-status">Loading…</p>
        ) : (
          <div className="legal-document-body">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
      </section>
    </main>
  )
}
