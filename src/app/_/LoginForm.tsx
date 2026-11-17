'use client'

import { ArrowRight, Mail, User } from 'lucide-react'
import { useState } from 'react'

import { loginAction, type AuthFormState } from '+/actions/auth'
import Field from '+/components/Field'
import FormError from '+/components/FormError'
import { IconInput, PasswordInput } from '+/components/IconInput'
import { useFormAction } from '+/hooks/useFormAction'

import type { AccountAwaitingCode } from './AuthModal'

const initialState: AuthFormState = { success: false }

export type DemoUser = { name: string; email: string; password: string }

type LoginFormProps = {
  next?: string
  // A line shown above the form, such as the confirmation that a new password was saved.
  notice: string | null
  // Only filled in development, to fill the form with one click.
  demoUsers: DemoUser[]
  onForgotPassword: () => void
  onEmailAwaitsCode: (account: AccountAwaitingCode) => void
}

export default function LoginForm({ next, notice, demoUsers, onForgotPassword, onEmailAwaitsCode }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isDemoMenuOpen, setIsDemoMenuOpen] = useState(false)

  // A right password on an email that still waits for its code moves the window to the code step.
  const logIn = async (previousState: AuthFormState, formData: FormData) => {
    const result = await loginAction(previousState, formData)
    if (result.confirmEmail) onEmailAwaitsCode({ ...result.confirmEmail, password: String(formData.get('password') ?? '') })
    return result
  }

  const { state, onSubmit, isPending } = useFormAction(logIn, initialState)
  const errors = state.errors ?? {}

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {next && <input type="hidden" name="next" value={next} />}

      {notice && (
        <p role="status" className="rounded-xl border border-line bg-desk/60 px-3 py-2.5 text-sm">
          {notice}
        </p>
      )}

      <Field label="Email" htmlFor="login-email" error={errors.email?.[0]}>
        <div className="relative">
          {demoUsers.length > 0 && (
            <div className="absolute -top-[2.625rem] right-0">
              <button
                type="button"
                onClick={() => setIsDemoMenuOpen(!isDemoMenuOpen)}
                aria-label="Demo users"
                aria-expanded={isDemoMenuOpen}
                title="Demo users"
                className="grid size-7 place-items-center rounded-lg border border-pen/25 bg-pen/5 text-pen hover:bg-pen/10"
              >
                <User className="size-4" aria-hidden="true" />
              </button>
              {isDemoMenuOpen && (
                <div className="absolute top-full right-0 z-10 mt-2 w-72 max-w-[calc(100vw-4rem)] overflow-hidden rounded-xl border border-line bg-sheet shadow-xl">
                  <div className="border-b border-line px-4 py-3">
                    <p className="text-sm font-semibold">Demo users</p>
                    <p className="text-xs text-muted">Pick one to fill the form</p>
                  </div>
                  <ul className="max-h-36 overflow-y-auto">
                    {demoUsers.map((user) => (
                      <li key={user.email}>
                        <button
                          type="button"
                          onClick={() => {
                            setEmail(user.email)
                            setPassword(user.password)
                            setIsDemoMenuOpen(false)
                          }}
                          className="flex w-full items-center gap-3 border-b border-line px-4 py-2.5 text-left last:border-b-0 hover:bg-desk/50"
                        >
                          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-pen/10 text-pen">
                            <User className="size-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-medium">{user.name}</span>
                            <span className="block truncate text-xs text-muted">{user.email}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <IconInput
            icon={Mail}
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="janedoe@mail.com"
            required
            data-autofocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'login-email-error' : undefined}
          />
        </div>
      </Field>

      <Field label="Password" htmlFor="login-password" error={errors.password?.[0]}>
        <PasswordInput
          id="login-password"
          name="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? 'login-password-error' : undefined}
        />
      </Field>

      <FormError message={errors.form?.[0]} />

      <button type="submit" disabled={isPending} className="button button-primary w-full py-3.5">
        {isPending ? 'Logging in…' : 'Log in'}
        {!isPending && <ArrowRight className="size-5" aria-hidden="true" />}
      </button>

      <p className="text-center text-sm">
        <button type="button" onClick={onForgotPassword} className="font-medium text-pen hover:text-pen-deep">
          Forgot your password?
        </button>
      </p>
    </form>
  )
}
