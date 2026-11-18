'use client'

import { requestPasswordResetAction, type AuthFormState } from '+/actions/auth'
import Field from '+/components/Field'
import FormError from '+/components/FormError'
import { useFormAction } from '+/hooks/useFormAction'

const initialState: AuthFormState = { success: false }

export default function ForgotPasswordForm({ onBackToLogin }: { onBackToLogin: () => void }) {
  const { state, onSubmit, isPending } = useFormAction(requestPasswordResetAction, initialState)
  const errors = state.errors ?? {}

  return (
    <div className="space-y-5">
      <div className="pr-10">
        <h2 className="font-display text-2xl font-bold tracking-tight">Forgot your password?</h2>
        <p className="mt-2 text-sm text-muted">Enter the email of your account and we will send a link to choose a new password.</p>
      </div>

      {state.success ? (
        <p role="status" className="rounded-lg border border-line bg-desk/60 px-3 py-2.5 text-sm">
          If an account uses that email, a reset link is on its way. The link works for one hour.
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <Field label="Email" htmlFor="forgot-email" error={errors.email?.[0]}>
            <input
              id="forgot-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              data-autofocus
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'forgot-email-error' : undefined}
              className="field-input"
            />
          </Field>

          <FormError message={errors.form?.[0]} />

          <button type="submit" disabled={isPending} className="button button-primary w-full">
            {isPending ? 'Sending the link…' : 'Send reset link'}
          </button>
        </form>
      )}

      <p className="text-sm">
        <button type="button" onClick={onBackToLogin} className="text-link">
          Back to log in
        </button>
      </p>
    </div>
  )
}
