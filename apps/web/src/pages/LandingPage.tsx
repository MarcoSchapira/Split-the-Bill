import { Link } from 'react-router-dom'
import { LandingHeader } from '../components/LandingHeader'

export function LandingPage() {
  return (
    <main className="landing-page landing-page-compact">
      <LandingHeader showFeaturesLink={false} />

      <section className="landing-hero landing-hero-compact">
        <div className="landing-copy">
          <p className="eyebrow">Shared expenses made clear</p>
          <h1>
            Split Bills
            <span className="landing-title-accent">Track Expenses</span>
          </h1>
          <p className="landing-lede">
            EquiSplit keeps friends, bills, and balances in one calm place so
            everyone knows where things stand.
          </p>
          <div className="landing-actions">
            <Link className="landing-button landing-button-primary" to="/register">
              Get Started
            </Link>
            <Link className="landing-button landing-button-secondary" to="/login">
              Login
            </Link>
          </div>
        </div>
        <div className="hero-image-wrap">
          <img
            className="hero-image"
            src="/dashboard.png"
            alt="EquiSplit dashboard showing balances and people"
          />
        </div>
      </section>
    </main>
  )
}
