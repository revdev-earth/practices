'use client'

import { useEffect, useState, useTransition } from 'react'

import { confirmEmailAction, resendConfirmationCodeAction, type AuthFormState } from '+/actions/auth'
import Field from '+/components/Field'
import FormError from '+/components/FormError'
import { useFormAction } from '+/hooks/useFormAction'

import type { AccountAwaitingCode } from './AuthModal'

const initialState: AuthFormState = { success: false }

type ConfirmEmailFormProps = {
  account: AccountAwaitingCode
  next?: string
  codeLength: number
  codeValidMinutes: number
  onUseAnotherEmail: () => void
}

// The step between creating an account and using it: the person types the code sent to the email.
export default function ConfirmEmailForm({ account, next, codeLength, codeValidMinutes, onUseAnotherEmail }: ConfirmEmailFormProps) {
  // The code travels with the email and the password of the account, both kept in memory by the window.
  const attachAccount = (formData: FormData) => {
    formData.set('email', account.email)
    formData.set('password', account.password)
    if (next) formData.set('next', next)
  }

  const { state, onSubmit, isPending } = useFormAction(confirmEmailAction, initialState, attachAccount)
  const errors = state.errors ?? {}

  const [newCodeAllowedAt, setNewCodeAllowedAt] = useState(() => Date.now() + account.retryInSeconds * 1000)
  const [now, setNow] = useState(() => Date.now())
  const [resendNote, setResendNote] = useState<string | null>(null)
  const [isResending, startResending] = useTransition()

  const secondsUntilNewCode = Math.max(Math.ceil((newCodeAllowedAt - now) / 1000), 0)
  const isWaitingForNewCode = secondsUntilNewCode > 0

  useEffect(() => {
    if (!isWaitingForNewCode) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [isWaitingForNewCode])

  const sendNewCode = () =>
    startResending(async () => {
      const delivery = await resendConfirmationCodeAction(account.email)
      setNewCodeAllowedAt(Date.now() + delivery.retryInSeconds * 1000)
      setNow(Date.now())
      setResendNote(delivery.sent ? 'A new code is on its way. The earlier one stopped working.' : 'The code from the last email still works.')
    })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="pr-10">
        <h2 className="font-display text-2xl font-bold tracking-tight">Confirm your email</h2>
        <p className="mt-2 text-sm text-muted">
          We sent a {codeLength}-digit code to <span className="font-semibold wrap-anywhere text-ink">{account.email}</span>. It works for{' '}
          {codeValidMinutes} minutes.
        </p>
      </div>

      <Field label="Code from the email" htmlFor="confirm-code" error={errors.code?.[0]}>
        <input
          id="confirm-code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={codeLength + 1}
          required
          data-autofocus
          aria-invalid={Boolean(errors.code)}
          aria-describedby={errors.code ? 'confirm-code-error' : undefined}
          className="field-input code-input"
        />
      </Field>

      <FormError message={errors.form?.[0]} />

      <button type="submit" disabled={isPending} className="button button-primary w-full">
        {isPending ? 'Confirming…' : 'Confirm email'}
      </button>

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 text-sm">
        {isWaitingForNewCode ? (
          <p className="text-muted tabular-nums">New code available in {secondsUntilNewCode} s</p>
        ) : (
          <button type="button" onClick={sendNewCode} disabled={isResending} className="text-link">
            {isResending ? 'Sending…' : 'Send a new code'}
          </button>
        )}
        <button type="button" onClick={onUseAnotherEmail} className="text-link">
          Use a different email
        </button>
      </div>

      {resendNote && (
        <p role="status" className="text-sm text-muted">
          {resendNote}
        </p>
      )}
    </form>
  )
}
