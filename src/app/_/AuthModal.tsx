'use client'

import { useSearchParams } from 'next/navigation'
import { useState } from 'react'

import type { PendingEmailConfirmation } from '+/actions/auth'
import Modal from '+/components/Modal'
import { AUTH_VIEW_PARAM, authModalPath, parseAuthView, type AuthView } from '+/lib/redirects'

import ConfirmEmailForm from './ConfirmEmailForm'
import ForgotPasswordForm from './ForgotPasswordForm'
import LoginForm, { type DemoUser } from './LoginForm'
import RegisterForm from './RegisterForm'
import ResetPasswordForm from './ResetPasswordForm'

// The code step is not in the address. It needs the password just typed, which only lives in memory.
type AuthStep = AuthView | 'confirm'

// The account waiting for its code, with the password that proves who created it.
export type AccountAwaitingCode = PendingEmailConfirmation & { password: string }

type AuthModalProps = {
  minPasswordLength: number
  confirmationCodeLength: number
  confirmationCodeValidMinutes: number
  demoUsers: DemoUser[]
}

const STEP_LABELS: Record<AuthStep, string> = {
  login: 'Log in',
  register: 'Create an account',
  confirm: 'Confirm your email',
  forgot: 'Forgot your password',
  reset: 'Choose a new password',
}

const ENTRY_TABS: { view: AuthView; label: string }[] = [
  { view: 'login', label: 'Log in' },
  { view: 'register', label: 'Create account' },
]

// Login, registration, the email code and password recovery, all in one window on top of the landing page.
// The address says which step is open, so links from emails, the back button and a reload all land on the right one.
export default function AuthModal({ minPasswordLength, confirmationCodeLength, confirmationCodeValidMinutes, demoUsers }: AuthModalProps) {
  const searchParams = useSearchParams()
  const requestedView = parseAuthView(searchParams.get(AUTH_VIEW_PARAM))
  const next = searchParams.get('next') ?? undefined
  const resetToken = searchParams.get('token') ?? ''

  const [accountAwaitingCode, setAccountAwaitingCode] = useState<AccountAwaitingCode | null>(null)
  const [loginNotice, setLoginNotice] = useState<string | null>(null)

  const isOpen = requestedView !== null
  const openStep: AuthStep | null = !requestedView ? null : accountAwaitingCode ? 'confirm' : requestedView

  // The back button also closes the window. What the window remembered goes away with it.
  if (!isOpen && (accountAwaitingCode || loginNotice)) {
    setAccountAwaitingCode(null)
    setLoginNotice(null)
  }

  // While the window leaves, it keeps showing the step it had.
  const [lastStep, setLastStep] = useState<AuthStep>(openStep ?? 'login')
  if (openStep && openStep !== lastStep) setLastStep(openStep)
  const step = openStep ?? lastStep

  const showView = (view: AuthView) => {
    setAccountAwaitingCode(null)
    window.history.replaceState(null, '', authModalPath(view, { next }))
  }

  const close = () => window.history.replaceState(null, '', '/')

  const showLoginAfterPasswordChange = () => {
    setLoginNotice('Password saved. Log in with the new one.')
    showView('login')
  }

  const isEntryStep = step === 'login' || step === 'register'

  return (
    <Modal isOpen={isOpen} onClose={close} label={STEP_LABELS[step]} step={step}>
      {isEntryStep && (
        <div className="px-6 pt-14 sm:px-8">
          <div role="tablist" aria-label="Account" className="flex rounded-2xl bg-desk p-1">
            {ENTRY_TABS.map((tab) => {
              const isActive = tab.view === step
              return (
                <button
                  key={tab.view}
                  type="button"
                  role="tab"
                  id={`auth-tab-${tab.view}`}
                  aria-selected={isActive}
                  aria-controls="auth-step"
                  onClick={() => showView(tab.view)}
                  className={`flex-1 rounded-xl px-4 py-2.5 font-semibold transition-all duration-300 ${isActive ? 'bg-sheet text-pen shadow-md' : 'text-muted hover:text-ink'}`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div
        key={step}
        id="auth-step"
        role={isEntryStep ? 'tabpanel' : undefined}
        aria-labelledby={isEntryStep ? `auth-tab-${step}` : undefined}
        className={`modal-step px-6 pb-7 sm:px-8 sm:pb-8 ${isEntryStep ? 'pt-6' : 'pt-7 sm:pt-8'}`}
      >
        {step === 'login' && (
          <LoginForm
            next={next}
            notice={loginNotice}
            demoUsers={demoUsers}
            onForgotPassword={() => showView('forgot')}
            onEmailAwaitsCode={setAccountAwaitingCode}
          />
        )}

        {step === 'register' && <RegisterForm minPasswordLength={minPasswordLength} onEmailAwaitsCode={setAccountAwaitingCode} />}

        {step === 'confirm' && accountAwaitingCode && (
          <ConfirmEmailForm
            account={accountAwaitingCode}
            next={next}
            codeLength={confirmationCodeLength}
            codeValidMinutes={confirmationCodeValidMinutes}
            onUseAnotherEmail={() => showView('register')}
          />
        )}

        {step === 'forgot' && <ForgotPasswordForm onBackToLogin={() => showView('login')} />}

        {step === 'reset' && (
          <ResetPasswordForm
            token={resetToken}
            minPasswordLength={minPasswordLength}
            onPasswordSaved={showLoginAfterPasswordChange}
            onRequestNewLink={() => showView('forgot')}
          />
        )}
      </div>
    </Modal>
  )
}
