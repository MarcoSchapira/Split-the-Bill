import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { LandingHeader } from '../components/LandingHeader'
import { LandingFeatureShowcase } from '../components/landing/LandingFeatureShowcase'
import {
  faqItems,
  howItWorksSteps,
  whyChooseItems,
} from '../components/landing/landingContent'
import '../styles/landing.css'

export function LandingPage() {
  return (
    <main className="landing-page">
      <LandingHeader />

      <section className="landing-hero-v2" aria-labelledby="landing-hero-heading">
        <div className="landing-copy">
          <p className="eyebrow">Shared expenses made clear</p>
          <h1 id="landing-hero-heading">
            Split bills quickly{' '}
            <span className="landing-gradient-text">and accurately</span>
          </h1>
          <p className="landing-lede">
            Divide shared expenses between friends without doing the math yourself.
            Scan receipts, assign items, and track who owes what — synced across
            web and mobile.
          </p>
          <div className="landing-actions">
            <Link className="landing-button landing-button-primary landing-button-with-icon" to="/register">
              Get Started Free
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
            <Link className="landing-button landing-button-secondary" to="/login">
              Login
            </Link>
          </div>
        </div>

        <div className="landing-hero-visual" aria-hidden="true">
          <div className="landing-hero-stage">
            <div className="landing-float-card landing-float-card--balance">
              <strong>Net balance</strong>
              <span>+$24.50 owed to you</span>
            </div>
            <div className="landing-float-card landing-float-card--receipt">
              <strong>Receipt scanned</strong>
              <span>6 items ready to split</span>
            </div>
            <div className="landing-hero-image-wrap">
              <img
                src="/images/dashboard.png"
                alt="BillCompass dashboard showing shared balances, friends, and recent bills"
              />
            </div>
          </div>
        </div>
      </section>

      <section
        className="landing-section"
        id="how-it-works"
        aria-labelledby="how-it-works-heading"
      >
        <div className="landing-section-heading">
          <p className="eyebrow">How it works</p>
          <h2 id="how-it-works-heading">
            From receipt to settled up in{' '}
            <span className="landing-gradient-text">three steps</span>
          </h2>
          <p>
            BillCompass keeps the flow simple: capture the bill, split it with the
            right people, and track balances until everyone is square.
          </p>
        </div>
        <ol className="landing-steps">
          {howItWorksSteps.map((step) => (
            <li className="landing-step-card" key={step.step}>
              <span className="landing-step-badge" aria-hidden="true">
                {step.step}
              </span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="landing-section landing-split-section"
        aria-labelledby="mobile-heading"
      >
        <div className="landing-split-row">
          <div className="landing-split-copy">
            <p className="eyebrow">Mobile app</p>
            <h2 id="mobile-heading">
              Also available
              <span className="landing-split-title-accent">on mobile too</span>
            </h2>
            <p>
              Take BillCompass with you on iPhone. Scan receipts, split bills, and
              check balances on the go — always live and synced with the web.
            </p>
            <img
              className="landing-app-store-badge"
              src="/download-on-the-app-store-logo-png-23.png"
              alt="Download on the App Store"
            />
          </div>
          <div className="landing-split-visual">
            <div className="landing-split-frame">
              <img
                src="/split-the-bill-hero.png"
                alt="BillCompass mobile app shown across multiple phone mockups"
              />
            </div>
          </div>
        </div>
      </section>

      <section
        className="landing-section"
        id="features"
        aria-labelledby="features-heading"
      >
        <div className="landing-section-heading">
          <p className="eyebrow">Everything you need</p>
          <h2 id="features-heading">
            Built for real shared expenses,{' '}
            <span className="landing-gradient-text">not spreadsheets</span>
          </h2>
          <p>
            From receipt scans to group tabs, every feature is designed to keep
            bills fair, organized, and easy for everyone to understand.
          </p>
        </div>
        <LandingFeatureShowcase />
      </section>

      <section
        className="landing-section"
        id="why-choose"
        aria-labelledby="why-choose-heading"
      >
        <div className="landing-section-heading">
          <p className="eyebrow">Why people choose BillCompass</p>
          <h2 id="why-choose-heading">
            Fair splits without the{' '}
            <span className="landing-gradient-text">friction</span>
          </h2>
          <p>
            Whether it is dinner with friends or rent with roommates, BillCompass
            gives everyone a clear picture of who paid, who owes, and what is left.
          </p>
        </div>
        <div className="landing-why-grid">
          {whyChooseItems.map((item) => {
            const Icon = item.icon
            return (
              <article className="landing-why-card" key={item.title}>
                <div className="landing-why-icon" aria-hidden="true">
                  <Icon strokeWidth={2} />
                </div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="landing-section" aria-labelledby="free-heading">
        <div className="landing-free-banner">
          <span className="landing-free-badge">100% free</span>
          <p className="eyebrow">No subscriptions. No paywalls.</p>
          <h2 id="free-heading">Split all your bills for free</h2>
          <p>
            BillCompass is fully free to use. Create your account, invite friends,
            scan receipts, and track every shared expense without worrying about
            premium tiers or hidden fees.
          </p>
          <Link className="landing-button landing-button-on-dark" to="/register">
            Create free account
          </Link>
        </div>
      </section>

      <section className="landing-section" id="faq" aria-labelledby="faq-heading">
        <div className="landing-section-heading">
          <p className="eyebrow">FAQ</p>
          <h2 id="faq-heading">Questions, answered</h2>
          <p>Quick answers to the things people ask before their first split.</p>
        </div>
        <div className="landing-faq-list">
          {faqItems.map((item) => (
            <details className="landing-faq-item" key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="landing-section" aria-labelledby="final-cta-heading">
        <div className="landing-final-cta-v2">
          <p className="eyebrow">Start splitting fairly</p>
          <h2 id="final-cta-heading">
            Ready for a clearer shared tab?
          </h2>
          <p>
            Create your free account, add your first friend, and turn your next
            receipt into a bill everyone can trust.
          </p>
          <div className="landing-actions">
            <Link className="landing-button landing-button-primary" to="/register">
              Get Started Free
            </Link>
            <Link className="landing-button landing-button-secondary" to="/login">
              Login
            </Link>
          </div>
        </div>
      </section>

      <footer className="landing-footer-v2">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <strong>BillCompass</strong>
            <p>
              Clear balances for shared expenses — scan receipts, split fairly,
              and stay synced with friends across web and mobile.
            </p>
          </div>
          <div className="landing-footer-col">
            <h4>Product</h4>
            <ul className="landing-footer-links">
              <li>
                <a href="#features">Features</a>
              </li>
              <li>
                <a href="#how-it-works">How it works</a>
              </li>
              <li>
                <a href="#faq">FAQ</a>
              </li>
            </ul>
          </div>
          <div className="landing-footer-col">
            <h4>Legal</h4>
            <ul className="landing-footer-links">
              <li>
                <Link to="/privacy">Privacy Policy</Link>
              </li>
              <li>
                <Link to="/terms">Terms of Service</Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="landing-footer-bottom">
          © {new Date().getFullYear()} BillCompass. Shared expenses, simplified.
        </p>
      </footer>
    </main>
  )
}
