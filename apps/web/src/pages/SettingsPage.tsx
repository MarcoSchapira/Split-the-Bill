import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle2, ExternalLink, KeyRound, Laptop2, LogOut, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import {
  changePassword,
  deleteAuthenticatedAccount,
  logoutAllSessions,
  recordAiReceiptConsent,
  updateCurrentUser,
} from '../api/authApi'
import { apiErrorMessage } from '../api/client'
import { queryClient } from '../api/queryClient'
import { useAuth } from '../auth/useAuth'
import { useToast } from '../components/ui/useToast'
import '../styles/settings.css'

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Enter a display name.').max(100, 'Use 100 characters or fewer.'),
})
const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: z.string().min(8, 'Use at least 8 characters.').max(100),
  confirmPassword: z.string(),
}).refine((value) => value.newPassword === value.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
})

type ProfileForm = z.infer<typeof profileSchema>
type PasswordForm = z.infer<typeof passwordSchema>

const PROFILE_NAME_ERROR_ID = 'settings-profile-name-error'
const PROFILE_EMAIL_HELP_ID = 'settings-profile-email-help'
const CURRENT_PASSWORD_ERROR_ID = 'settings-current-password-error'
const NEW_PASSWORD_ERROR_ID = 'settings-new-password-error'
const CONFIRM_PASSWORD_ERROR_ID = 'settings-confirm-password-error'

export function SettingsPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [deleteText, setDeleteText] = useState('')
  const profileForm = useForm<ProfileForm>({ resolver: zodResolver(profileSchema), defaultValues: { name: auth.user?.name ?? '' } })
  const passwordForm = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema), defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' } })

  useEffect(() => {
    profileForm.reset({ name: auth.user?.name ?? '' })
  }, [auth.user?.name, profileForm])

  const profileMutation = useMutation({
    mutationFn: ({ name }: ProfileForm) => updateCurrentUser(name),
    onSuccess: (user) => {
      auth.replaceUser(user)
      showToast('Profile updated.')
    },
    onError: (error) => showToast(apiErrorMessage(error, 'Unable to update your profile.'), 'error'),
  })

  const passwordMutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }: PasswordForm) => changePassword(currentPassword, newPassword),
    onSuccess: () => {
      passwordForm.reset()
      showToast('Password changed. Other sessions were signed out.')
    },
    onError: (error) => showToast(apiErrorMessage(error, 'Unable to change your password.'), 'error'),
  })

  const consentMutation = useMutation({
    mutationFn: recordAiReceiptConsent,
    onSuccess: (user) => {
      auth.replaceUser(user)
      showToast('Receipt extraction consent saved.')
    },
    onError: (error) => showToast(apiErrorMessage(error, 'Unable to save consent.'), 'error'),
  })

  const logoutAllMutation = useMutation({
    mutationFn: logoutAllSessions,
    onSuccess: async () => {
      await auth.logout()
      navigate('/login', { replace: true })
    },
    onError: (error) => showToast(apiErrorMessage(error, 'Unable to log out every session.'), 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAuthenticatedAccount,
    onSuccess: async () => {
      queryClient.clear()
      await auth.logout()
      navigate('/', { replace: true })
    },
    onError: (error) => showToast(apiErrorMessage(error, 'Unable to delete your account.'), 'error'),
  })

  return (
    <section className="bc-page">
      <header className="bc-page-header">
        <div className="bc-page-header__copy">
          <p className="bc-eyebrow">Account</p>
          <h1 className="bc-page-title">Settings</h1>
          <p className="bc-page-subtitle">Manage your profile, security, privacy, and BillCompass account.</p>
        </div>
      </header>

      <div className="bc-settings-layout">
        <div className="bc-stack">
          <section className="bc-card">
            <div className="bc-card-header"><div className="bc-settings-heading"><UserRound size={20} /><div><h2 className="bc-card-title">Profile</h2><p>Your name is shown to friends and group members.</p></div></div></div>
            <form className="bc-form" onSubmit={profileForm.handleSubmit((value) => profileMutation.mutate(value))}>
              <label className="bc-field">Display name
                <input
                  aria-describedby={profileForm.formState.errors.name ? PROFILE_NAME_ERROR_ID : undefined}
                  aria-invalid={Boolean(profileForm.formState.errors.name)}
                  autoComplete="name"
                  {...profileForm.register('name')}
                  placeholder="Your name"
                />
                {profileForm.formState.errors.name ? <span className="bc-field__error" id={PROFILE_NAME_ERROR_ID} role="alert">{profileForm.formState.errors.name.message}</span> : null}
              </label>
              <label className="bc-field">Email
                <input aria-describedby={PROFILE_EMAIL_HELP_ID} disabled readOnly value={auth.user?.email ?? ''} />
                <span className="bc-help" id={PROFILE_EMAIL_HELP_ID}>Your sign-in email cannot be changed.</span>
              </label>
              <div><button className="bc-button bc-button--primary" disabled={profileMutation.isPending || !profileForm.formState.isDirty} type="submit">{profileMutation.isPending ? 'Saving…' : 'Save profile'}</button></div>
            </form>
          </section>

          <section className="bc-card">
            <div className="bc-card-header"><div className="bc-settings-heading"><KeyRound size={20} /><div><h2 className="bc-card-title">Password</h2><p>Changing it signs out every other device.</p></div></div></div>
            <form className="bc-form" onSubmit={passwordForm.handleSubmit((value) => passwordMutation.mutate(value))}>
              <label className="bc-field">Current password<input aria-describedby={passwordForm.formState.errors.currentPassword ? CURRENT_PASSWORD_ERROR_ID : undefined} aria-invalid={Boolean(passwordForm.formState.errors.currentPassword)} autoComplete="current-password" type="password" {...passwordForm.register('currentPassword')} />{passwordForm.formState.errors.currentPassword ? <span className="bc-field__error" id={CURRENT_PASSWORD_ERROR_ID} role="alert">{passwordForm.formState.errors.currentPassword.message}</span> : null}</label>
              <div className="bc-form-grid">
                <label className="bc-field">New password<input aria-describedby={passwordForm.formState.errors.newPassword ? NEW_PASSWORD_ERROR_ID : undefined} aria-invalid={Boolean(passwordForm.formState.errors.newPassword)} autoComplete="new-password" type="password" {...passwordForm.register('newPassword')} />{passwordForm.formState.errors.newPassword ? <span className="bc-field__error" id={NEW_PASSWORD_ERROR_ID} role="alert">{passwordForm.formState.errors.newPassword.message}</span> : null}</label>
                <label className="bc-field">Confirm password<input aria-describedby={passwordForm.formState.errors.confirmPassword ? CONFIRM_PASSWORD_ERROR_ID : undefined} aria-invalid={Boolean(passwordForm.formState.errors.confirmPassword)} autoComplete="new-password" type="password" {...passwordForm.register('confirmPassword')} />{passwordForm.formState.errors.confirmPassword ? <span className="bc-field__error" id={CONFIRM_PASSWORD_ERROR_ID} role="alert">{passwordForm.formState.errors.confirmPassword.message}</span> : null}</label>
              </div>
              <div><button className="bc-button" disabled={passwordMutation.isPending} type="submit">{passwordMutation.isPending ? 'Changing…' : 'Change password'}</button></div>
            </form>
          </section>
        </div>

        <div className="bc-stack">
          <section className="bc-card">
            <div className="bc-card-header"><div className="bc-settings-heading"><ShieldCheck size={20} /><div><h2 className="bc-card-title">Receipt privacy</h2><p>Control AI-assisted receipt extraction.</p></div></div></div>
            {auth.user?.aiReceiptConsentAt ? (
              <div className="bc-settings-consent"><CheckCircle2 size={20} /><div><strong>Consent recorded</strong><span>Saved {new Date(auth.user.aiReceiptConsentAt).toLocaleDateString('en-CA')}.</span></div></div>
            ) : (
              <div className="bc-stack">
                <p className="bc-settings-copy">Receipt images are sent to Google Gemini only when you choose Scan receipt. Images are used to extract editable details and are not retained on the bill.</p>
                <button className="bc-button bc-button--soft" disabled={consentMutation.isPending} onClick={() => consentMutation.mutate()} type="button">{consentMutation.isPending ? 'Saving…' : 'Record consent'}</button>
              </div>
            )}
            <Link className="bc-settings-link" to="/privacy">Read the privacy policy <ExternalLink size={15} /></Link>
          </section>

          <section className="bc-card">
            <div className="bc-card-header"><div className="bc-settings-heading"><Laptop2 size={20} /><div><h2 className="bc-card-title">Sessions</h2><p>Control where your account is signed in.</p></div></div></div>
            <div className="bc-settings-actions">
              <button className="bc-button" onClick={() => void auth.logout().then(() => navigate('/login', { replace: true }))} type="button"><LogOut size={17} />Log out this device</button>
              <AlertDialog.Root>
                <AlertDialog.Trigger asChild><button className="bc-button bc-button--danger" type="button"><Laptop2 size={17} />Log out all devices</button></AlertDialog.Trigger>
                <AlertDialog.Portal><AlertDialog.Overlay className="modal-backdrop" /><AlertDialog.Content className="modal-card">
                  <AlertDialog.Title>Log out every device?</AlertDialog.Title>
                  <AlertDialog.Description>You will need to sign in again on this browser and every other device using BillCompass.</AlertDialog.Description>
                  <div className="bc-dialog-actions"><AlertDialog.Cancel asChild><button className="bc-button" type="button">Cancel</button></AlertDialog.Cancel><AlertDialog.Action asChild><button className="bc-button bc-button--danger" disabled={logoutAllMutation.isPending} onClick={() => logoutAllMutation.mutate()} type="button">Log out all</button></AlertDialog.Action></div>
                </AlertDialog.Content></AlertDialog.Portal>
              </AlertDialog.Root>
            </div>
          </section>

          <section className="bc-card bc-settings-about">
            <div><strong>BillCompass for web</strong><span>Version 1.0.0</span></div>
            <div><Link to="/privacy">Privacy policy</Link><Link to="/terms">Terms of service</Link><a href="mailto:privacy@split-the-bill.net">Support</a></div>
          </section>

          <section className="bc-card bc-settings-danger">
            <div className="bc-card-header"><div className="bc-settings-heading"><Trash2 size={20} /><div><h2 className="bc-card-title">Delete account</h2><p>Shared bills retain an anonymized “Deleted Account” participant.</p></div></div></div>
            <AlertDialog.Root onOpenChange={(open) => !open && setDeleteText('')}>
              <AlertDialog.Trigger asChild><button className="bc-button bc-button--danger" type="button">Delete my account</button></AlertDialog.Trigger>
              <AlertDialog.Portal><AlertDialog.Overlay className="modal-backdrop" /><AlertDialog.Content className="modal-card">
                <AlertDialog.Title>Permanently delete your account?</AlertDialog.Title>
                <AlertDialog.Description>This cannot be undone. Your profile and personal data will be deleted or anonymized as described in the privacy policy.</AlertDialog.Description>
                <label className="bc-field">Type DELETE to continue<input onChange={(event) => setDeleteText(event.target.value)} value={deleteText} /></label>
                <div className="bc-dialog-actions"><AlertDialog.Cancel asChild><button className="bc-button" type="button">Cancel</button></AlertDialog.Cancel><AlertDialog.Action asChild><button className="bc-button bc-button--danger" disabled={deleteText !== 'DELETE' || deleteMutation.isPending} onClick={() => deleteMutation.mutate()} type="button">Delete permanently</button></AlertDialog.Action></div>
              </AlertDialog.Content></AlertDialog.Portal>
            </AlertDialog.Root>
          </section>
        </div>
      </div>
    </section>
  )
}
