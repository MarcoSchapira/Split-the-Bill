import { Link } from 'react-router-dom'
import { LandingHeader } from '../components/LandingHeader'

const features = [
  {
    eyebrow: 'Dashboard',
    title: 'Know your balance at a glance.',
    description:
      'See what you owe, what friends owe you, and your net balance in one clear overview.',
    placeholder: 'Balance dashboard preview',
  },
  {
    eyebrow: 'Groups',
    title: 'Organize every shared expense.',
    description:
      'Create groups for roommates, trips, or dinner plans and keep the shared tab together.',
    placeholder: 'Group expenses image',
  },
  {
    eyebrow: 'Friends',
    title: 'Split direct bills with friends.',
    description:
      'Connect through invitations, then record the costs that belong between just the two of you.',
    placeholder: 'Friends invitation image',
  },
  {
    eyebrow: 'Invitations',
    title: 'Join only when you accept.',
    description:
      'Review friend and group invitations before they become part of your expense history.',
    placeholder: 'Invitation inbox image',
  },
  {
    eyebrow: 'Bills',
    title: 'Keep charges accurate.',
    description:
      'Add bills in CAD, choose who paid, and update or remove eligible entries as plans change.',
    placeholder: 'Bill editor image',
  },
  {
    eyebrow: 'Activity',
    title: 'Follow every update.',
    description:
      'Track bill changes and invitation responses with a recent activity feed built into your account.',
    placeholder: 'Recent activity image',
  },
]

export function OldLandingPage() {
  return (
    <main className="landing-page">
      <LandingHeader />

      <section className="landing-hero">
        <div className="landing-copy">
          <p className="eyebrow">Shared expenses made clear</p>
          <h1>Split bills. Keep friendships simple.</h1>
          <p className="landing-lede">
            EquiSplit keeps groups, invitations, bills, and balances in one
            calm place so everyone knows where things stand.
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
        <ImagePlaceholder
          className="hero-placeholder"
          description="Replace with a lifestyle or dashboard hero image"
          label="Hero image placeholder"
        />
      </section>

      <section className="landing-features" id="features" aria-labelledby="features-heading">
        <div className="landing-section-heading">
          <p className="eyebrow">Everything in one ledger</p>
          <h2 id="features-heading">Made for sharing, designed for clarity.</h2>
          <p>
            From a first invitation to an updated bill, each step stays easy to
            review and understand.
          </p>
        </div>
        <div className="feature-list">
          {features.map((feature, index) => (
            <article
              className={`feature-row${index % 2 === 1 ? ' feature-row-reverse' : ''}`}
              key={feature.title}
            >
              <div className="feature-copy">
                <p className="eyebrow">{feature.eyebrow}</p>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
              <ImagePlaceholder
                className="feature-placeholder"
                description="Future product or lifestyle photograph"
                label={feature.placeholder}
              />
            </article>
          ))}
        </div>
      </section>

      <section className="landing-final-cta">
        <p className="eyebrow">Start splitting fairly</p>
        <h2>Ready for a clearer shared tab?</h2>
        <p>Create your account and set up your first group in minutes.</p>
        <div className="landing-actions">
          <Link className="landing-button landing-button-primary" to="/register">
            Create account
          </Link>
          <Link className="landing-button landing-button-on-dark" to="/login">
            Login
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <strong>EquiSplit</strong>
        <p>Clear balances for shared expenses.</p>
      </footer>
    </main>
  )
}

function ImagePlaceholder({
  className,
  description,
  label,
}: {
  className: string
  description: string
  label: string
}) {
  return (
    <div
      aria-label={label}
      className={`landing-placeholder ${className}`}
      role="img"
    >
      <span>Image placeholder</span>
      <strong>{label}</strong>
      <small>{description}</small>
    </div>
  )
}
