import { Link } from 'react-router-dom'

type LandingHeaderProps = {
  minimal?: boolean
}

export function LandingHeader({ minimal = false }: LandingHeaderProps) {
  return (
    <header className="landing-header">
      <Link className="landing-brand" to="/" aria-label="BillCompass home">
        <span className="eyebrow">BillCompass</span>
        <strong>Shared expenses, simplified</strong>
      </Link>
      <nav className="landing-navigation" aria-label="Public navigation">
        {minimal ? null : (
          <>
            <a className="landing-nav-link" href="/#how-it-works">
              How it works
            </a>
            <a className="landing-nav-link" href="/#features">
              Features
            </a>
            <a className="landing-nav-link" href="/#faq">
              FAQ
            </a>
          </>
        )}
        <Link className="landing-nav-link" to="/login">
          Login
        </Link>
        <Link className="landing-button landing-button-primary compact" to="/register">
          Get Started
        </Link>
      </nav>
    </header>
  )
}
