'use client'

import { ArrowRight, Mail, User } from 'lucide-react'

import { registerAction, type AuthFormState } from '+/actions/auth'
import Field from '+/components/Field'
import FormError from '+/components/FormError'
import { IconInput, PasswordInput } from '+/components/IconInput'
import { useFormAction } from '+/hooks/useFormAction'

import type { AccountAwaitingCode } from './AuthModal'

const initialState: AuthFormState = { success: false }

type RegisterFormProps = {
  minPasswordLength: number
  onEmailAwaitsCode: (account: AccountAwaitingCode) => void
}

export default function RegisterForm({ minPasswordLength, onEmailAwaitsCode }: RegisterFormProps) {
  // The account is created closed. The window moves to the step where the email code opens it.
  const createAccount = async (previousState: AuthFormState, formData: FormData) => {
    const result = await registerAction(previousState, formData)
    if (result.confirmEmail) onEmailAwaitsCode({ ...result.confirmEmail, password: String(formData.get('password') ?? '') })
    return result
  }

  const { state, onSubmit, isPending } = useFormAction(createAccount, initialState)
  const errors = state.errors ?? {}
  const passwordHint = `At least ${minPasswordLength} characters.`

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Field label="Name" htmlFor="register-name" hint="This is how others see you on the sign-up sheets." error={errors.name?.[0]}>
        <IconInput
          icon={User}
          id="register-name"
          name="name"
          type="text"
          autoComplete="name"
          maxLength={60}
          required
          data-autofocus
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? 'register-name-error' : 'register-name-hint'}
        />
      </Field>

      <Field label="Email" htmlFor="register-email" hint="A code goes to this address to confirm it is yours." error={errors.email?.[0]}>
        <IconInput
          icon={Mail}
          id="register-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'register-email-error' : 'register-email-hint'}
        />
      </Field>

      <Field label="Password" htmlFor="register-password" hint={passwordHint} error={errors.password?.[0]}>
        <PasswordInput
          id="register-password"
          name="password"
          autoComplete="new-password"
          minLength={minPasswordLength}
          required
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? 'register-password-error' : 'register-password-hint'}
        />
      </Field>

      <FormError message={errors.form?.[0]} />

      <button type="submit" disabled={isPending} className="button button-primary w-full py-3.5">
        {isPending ? 'Creating your account…' : 'Create account'}
        {!isPending && <ArrowRight className="size-5" aria-hidden="true" />}
      </button>
    </form>
  )
}
