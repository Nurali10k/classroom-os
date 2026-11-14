import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  CircleCheck,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Triangle,
} from 'lucide-react'

import { useAuth } from '../../hooks/useAuth'
import { DEMO_ADMIN_ACCOUNT } from '../../app/seed'
import { APP_NAME } from '../../utils/constants'
import Button from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Input'
import { Dot } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Loader'
import cx from '../../utils/cx'

const CAPABILITIES = [
  'timetable',
  'homework',
  'duty',
  'offline',
]

function BrandPanel({ isDemoMode }) {
  const { t } = useTranslation()

  return (
    <aside className="relative hidden flex-col justify-between border-r border-line bg-surface p-8 lg:flex">
      <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />

      <div className="relative">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <rect x="0.6" y="0.6" width="12.8" height="12.8" rx="2.4" stroke="white" strokeOpacity="0.5" />
              <rect x="3.6" y="3.6" width="6.8" height="6.8" rx="1.2" fill="white" />
            </svg>
          </span>
          <div className="leading-none">
            <p className="text-[13.5px] font-semibold tracking-[-0.015em] text-ink">{APP_NAME}</p>
            <p className="mt-1 font-mono tnum text-[10px] uppercase tracking-[0.13em] text-faint">
              {t('app.className')}
            </p>
          </div>
        </div>

        <h1 className="mt-10 max-w-[19ch] text-[26px] font-semibold leading-[1.2] tracking-[-0.03em] text-ink">
          {t('auth.brandHeading')}
        </h1>
        <p className="mt-3 max-w-[40ch] text-[13px] leading-6 text-muted">{t('app.tagline')}</p>

        <dl className="mt-9 flex flex-col gap-px overflow-hidden rounded-lg border border-line bg-line">
          {CAPABILITIES.map((capability) => (
            <div key={capability} className="flex items-start gap-3 bg-surface px-3.5 py-2.5">
              <dt className="font-mono tnum w-[86px] shrink-0 pt-px text-[10.5px] uppercase tracking-[0.1em] text-faint">
                {t(`auth.capabilities.${capability}.label`)}
              </dt>
              <dd className="text-[12.5px] leading-5 text-ink-soft">{t(`auth.capabilities.${capability}.description`)}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="relative flex items-center gap-2 border-t border-line pt-4">
        <Dot tone={isDemoMode ? 'warn' : 'success'} pulse />
        <span className="font-mono tnum text-[10.5px] uppercase tracking-[0.1em] text-faint">
          {isDemoMode ? t('auth.demoMode') : t('auth.firebaseMode')}
        </span>
      </div>
    </aside>
  )
}

function authErrorMessage(cause, t) {
  const messages = {
    'auth/email-already-in-use': 'auth.errors.emailExists',
    'auth/invalid-credential': 'auth.errors.invalidCredential',
    'auth/invalid-email': 'auth.errors.invalidEmail',
    'auth/invalid-api-key': 'auth.errors.invalidApiKey',
    'auth/network-request-failed': 'auth.errors.network',
    'auth/operation-not-allowed': 'auth.errors.operationDisabled',
    'auth/popup-blocked': 'auth.errors.popupBlocked',
    'auth/popup-closed-by-user': 'auth.errors.popupClosed',
    'auth/too-many-requests': 'auth.errors.tooManyRequests',
    'auth/unauthorized-domain': 'auth.errors.unauthorizedDomain',
    'auth/user-disabled': 'auth.errors.userDisabled',
    'auth/user-not-found': 'auth.errors.userNotFound',
    'auth/weak-password': 'auth.errors.weakPassword',
  }
  if (cause?.code === 'permission-denied' || cause?.code === 'firestore/permission-denied') {
    return t('auth.errors.firestoreDenied')
  }
  const key = messages[cause?.code]
  return key ? t(key) : t('auth.errors.generic')
}

export default function LoginPage() {
  const { t } = useTranslation()
  const { signIn, signUp, signInWithGoogle, isDemoMode } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const redirectTo = location.state?.from ?? '/dashboard'

  const [mode, setMode] = useState('sign-in')
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const isSignUp = mode === 'sign-up'

  const update = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
    setError(null)
  }

  const switchMode = (next) => {
    setMode(next)
    setError(null)
  }

  const fillDemoAdmin = () => {
    setMode('sign-in')
    setError(null)
    setForm({
      displayName: '',
      email: DEMO_ADMIN_ACCOUNT.email,
      password: DEMO_ADMIN_ACCOUNT.password,
      confirmPassword: '',
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)

    const email = form.email.trim().toLowerCase()
    const displayName = form.displayName.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return setError(t('auth.errors.invalidEmail'))
    }
    if (isSignUp && (displayName.length < 2 || displayName.length > 80)) {
      return setError(t('auth.errors.invalidName'))
    }
    if (form.password.length < (isSignUp ? 6 : 4)) {
      return setError(t('auth.errors.passwordLength', { count: isSignUp ? 6 : 4 }))
    }
    if (isSignUp && form.password !== form.confirmPassword) {
      return setError(t('auth.errors.passwordMismatch'))
    }

    setSubmitting(true)
    try {
      if (isSignUp) await signUp(email, form.password, displayName)
      else await signIn(email, form.password)
      navigate(redirectTo, { replace: true })
    } catch (cause) {
      setError(authErrorMessage(cause, t))
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError(null)
    setSubmitting(true)
    try {
      await signInWithGoogle()
      navigate(redirectTo, { replace: true })
    } catch (cause) {
      setError(authErrorMessage(cause, t))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
      <BrandPanel isDemoMode={isDemoMode} />

      <main className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-[380px]">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <rect x="0.6" y="0.6" width="12.8" height="12.8" rx="2.4" stroke="white" strokeOpacity="0.5" />
                <rect x="3.6" y="3.6" width="6.8" height="6.8" rx="1.2" fill="white" />
              </svg>
            </span>
            <p className="text-[13.5px] font-semibold tracking-[-0.015em] text-ink">{APP_NAME}</p>
          </div>

          <div className="mb-5 flex gap-1 rounded-md border border-line bg-surface p-0.5">
            {[
              ['sign-in', t('auth.signIn')],
              ['sign-up', t('auth.createAccount')],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => switchMode(value)}
                className={cx(
                  'h-[30px] flex-1 rounded-[5px] text-[12.5px] font-medium transition-colors',
                  mode === value ? 'bg-solid text-on-solid' : 'text-muted hover:text-ink',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <h2 className="text-[19px] font-semibold tracking-[-0.02em] text-ink">
            {isSignUp ? t('auth.joinTitle') : t('auth.welcomeBack')}
          </h2>
          <p className="mt-1 text-[12.5px] leading-5 text-muted">
            {isSignUp
              ? t('auth.joinDescription')
              : isDemoMode
                ? t('auth.demoDescription')
                : t('auth.firebaseDescription')}
          </p>

          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3.5" noValidate>
            <AnimatePresence initial={false}>
              {isSignUp && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <Field label={t('auth.fullName')} htmlFor="displayName">
                    <Input
                      id="displayName"
                      value={form.displayName}
                      onChange={update('displayName')}
                      placeholder={t('auth.fullName')}
                      autoComplete="name"
                      icon={CircleCheck}
                      maxLength={80}
                    />
                  </Field>
                </motion.div>
              )}
            </AnimatePresence>

            <Field label={t('auth.schoolEmail')} htmlFor="email">
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={update('email')}
                placeholder="name@school.io"
                autoComplete="email"
                icon={Mail}
                maxLength={254}
              />
            </Field>

            <Field
              label={t('auth.password')}
              htmlFor="password"
              hint={isSignUp ? t('auth.passwordHint') : undefined}
            >
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={update('password')}
                  placeholder="••••••••"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  icon={Lock}
                  className="pr-9"
                  minLength={isSignUp ? 6 : undefined}
                  maxLength={128}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-faint transition-colors hover:bg-sunken hover:text-ink"
                >
                  {showPassword ? <EyeOff size={13.5} /> : <Eye size={13.5} />}
                </button>
              </div>
            </Field>

            {isSignUp && (
              <Field label={t('auth.confirmPassword')} htmlFor="confirmPassword">
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={update('confirmPassword')}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  icon={Lock}
                  minLength={6}
                  maxLength={128}
                />
              </Field>
            )}

            <AnimatePresence initial={false}>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-start gap-2 rounded-md border border-danger-line bg-danger-soft px-2.5 py-2 text-[12px] leading-5 text-danger"
                >
                  <Triangle size={13} strokeWidth={2.1} className="mt-0.5 shrink-0" />
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={submitting}
              iconRight={submitting ? undefined : ArrowRight}
              className="mt-0.5"
            >
              {isSignUp ? t('auth.createAccount') : t('auth.signIn')}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3 text-[11px] text-faint">
            <span className="h-px flex-1 bg-line" />
            <span>{t('auth.orContinueWith')}</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <Button
            type="button"
            variant="secondary"
            size="lg"
            fullWidth
            loading={submitting}
            disabled={submitting}
            onClick={handleGoogleSignIn}
          >
            <GoogleMark />
            {t('auth.continueWithGoogle')}
          </Button>
          {isDemoMode && (
            <p className="mt-2 text-center text-[11px] leading-4 text-muted">
              {t('auth.googleUnavailable')}
            </p>
          )}

          {isDemoMode && (
            <section className="mt-5 rounded-lg border border-warn-line bg-warn-soft p-3">
              <p className="text-[12px] font-medium text-ink">{t('auth.demoAdmin')}</p>
              <p className="mt-1 text-[11.5px] leading-5 text-muted">
                {DEMO_ADMIN_ACCOUNT.email}
                <br />
                {t('auth.demoPassword')} <span className="font-mono">{DEMO_ADMIN_ACCOUNT.password}</span>
              </p>
              <button
                type="button"
                onClick={fillDemoAdmin}
                className="mt-2 text-[11.5px] font-medium text-accent-ink underline underline-offset-2"
              >
                {t('auth.fillDemo')}
              </button>
              <p className="mt-2 text-[10.5px] leading-4 text-muted">
                {t('auth.demoOnly')}
              </p>
            </section>
          )}

          <p className="mt-6 text-center text-[11.5px] leading-5 text-faint">
            {isDemoMode
              ? t('auth.demoModeStatus')
              : t('auth.firebaseStatus')}
          </p>
        </div>
      </main>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="mr-2 h-4 w-4">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(0 5)" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.74 7.18l7.64 5.92c4.46-4.12 7.14-10.2 7.14-17.57Z" />
      <path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.9 23.9 0 0 0 0 21.56l7.98-6.19Z" transform="translate(0 5)" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.78l-7.64-5.92c-2.12 1.42-4.84 2.25-8.27 2.25-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" transform="translate(0 -5)" />
    </svg>
  )
}

/** Exposed for the route table's loading state. */
export function LoginFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <Spinner size={18} className="text-muted" />
    </div>
  )
}
