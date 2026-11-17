'use client'

import { resetPasswordAction, type AuthFormState } from '+/actions/auth'
import Field from '+/components/Field'
import FormError from '+/components/FormError'
import { useFormAction } from '+/hooks/useFormAction'

const initialState: AuthFormState = { success: false }

type ResetPasswordFormProps = {
  // Comes in the link of the reset email.
  token: string
  minPasswordLength: number
  onPasswordSaved: () => void
  onRequestNewLink: () => void
}

export default function ResetPasswordForm({ token, minPasswordLength, onPasswordSaved, onRequestNewLink }: ResetPasswordFormProps) {
  // With the password saved, the window goes back to the login form.
  const saveNewPassword = async (previousState: AuthFormState, formData: FormData) => {
    const result = await resetPasswordAction(previousState, formData)
    if (result.success) onPasswordSaved()
    return result
  }

  const { state, onSubmit, isPending } = useFormAction(saveNewPassword, initialState)
  const errors = state.errors ?? {}
  const passwordHint = `At least ${minPasswordLength} characters.`

  if (!token) {
    return (
      <div className="space-y-5">
        <div className="pr-10">
          <h2 className="font-display text-2xl font-bold tracking-tight">Choose a new password</h2>
          <p className="mt-2 text-sm text-muted">This step opens from the link in the reset email. The link in the address bar is incomplete.</p>
        </div>
        <button type="button" onClick={onRequestNewLink} className="button button-primary w-full">
          Request a new link
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <h2 className="pr-10 font-display text-2xl font-bold tracking-tight">Choose a new password</h2>

      <input type="hidden" name="token" value={token} />

      <Field label="New password" htmlFor="reset-password" hint={passwordHint} error={errors.password?.[0]}>
        <input
          id="reset-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={minPasswordLength}
          required
          data-autofocus
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? 'reset-password-error' : 'reset-password-hint'}
          className="field-input"
        />
      </Field>

      <FormError message={errors.form?.[0]} />

      <button type="submit" disabled={isPending} className="button button-primary w-full">
        {isPending ? 'Saving the password…' : 'Save new password'}
      </button>

      {errors.form && (
        <p className="text-sm">
          <button type="button" onClick={onRequestNewLink} className="text-link">
            Request a new link
          </button>
        </p>
      )}
    </form>
  )
}
