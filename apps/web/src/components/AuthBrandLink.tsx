import { Link } from 'react-router-dom'

export function AuthBrandLink() {
  return (
    <Link className="auth-brand-link" to="/" aria-label="BillCompass home">
      <img
        alt=""
        aria-hidden="true"
        className="auth-brand-link__logo"
        height={56}
        src="/equishare_logo_mobile.png"
        width={56}
      />
      <strong className="auth-brand-link__name">BillCompass</strong>
    </Link>
  )
}
