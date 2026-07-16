import { Link } from 'react-router-dom'

type LandingHeaderProps = {
  showFeaturesLink?: boolean
}

export function LandingHeader({ showFeaturesLink = true }: LandingHeaderProps) {
  return (
    <header className="landing-header">
      <Link className="landing-brand" to="/" aria-label="EquiShare home">
        <span className="eyebrow">EquiShare</span>
        <strong>Split the Bill</strong>
      </Link>
      <nav className="landing-navigation" aria-label="Public navigation">
        {showFeaturesLink ? (
          <a className="landing-nav-link" href="#features">
            Features
          </a>
        ) : null}
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
