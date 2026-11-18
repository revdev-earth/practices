'use server'

import { APIError } from 'better-auth/api'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { clearAttempts, takeAttempt, takeAttempts, tryAgainLater, visitorAddress } from '+/lib/attemptLimits'
import { authServer, CONFIRMATION_CODE_LENGTH, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '+/lib/auth'
import {
  accountAcceptsPassword,
  discardUnconfirmedAccount,
  findAccountConfirmation,
  sendConfirmationCode,
  type ConfirmationCodeDelivery,
} from '+/lib/emailConfirmation'
import { rememberTimeZone } from '+/lib/practiceNotices'
import { safeNextPath } from '+/lib/redirects'

// The account exists and waits for the code sent to its email.
export type PendingEmailConfirmation = {
  email: string
  // Seconds before another code can be requested.
  retryInSeconds: number
}

export type AuthFormState = {
  success: boolean
  errors?: Record<string, string[]>
  // Present when the next step is typing the email code.
  confirmEmail?: PendingEmailConfirmation
}

const text = (formData: FormData, name: string) => String(formData.get(name) ?? '')

const emailField = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address'))

const newPasswordField = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `The password needs at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(MAX_PASSWORD_LENGTH, `The password can have up to ${MAX_PASSWORD_LENGTH} characters`)

const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Enter your password'),
})

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter the name others will see').max(60, 'The name can have up to 60 characters'),
  email: emailField,
  password: newPasswordField,
})

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: newPasswordField,
})

const confirmEmailSchema = z.object({
  email: emailField,
  password: z.string().min(1),
  // Spaces are dropped, so a code pasted as "123 456" works too.
  code: z
    .string()
    .transform((value) => value.replace(/\s/g, ''))
    .pipe(z.string().regex(new RegExp(`^\\d{${CONFIRMATION_CODE_LENGTH}}$`), `Enter the ${CONFIRMATION_CODE_LENGTH} digits from the email`)),
})

const fieldErrors = (error: z.ZodError) => z.flattenError(error).fieldErrors as Record<string, string[]>

const errorCode = (error: unknown) => (error instanceof APIError ? String(error.body?.code ?? '') : '')

export const loginAction = async (_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> => {
  const parsed = loginSchema.safeParse({ email: text(formData, 'email'), password: text(formData, 'password') })
  if (!parsed.success) return { success: false, errors: fieldErrors(parsed.error) }

  const verdict = await takeAttempts([
    ['login', parsed.data.email],
    ['loginFromAddress', await visitorAddress()],
  ])
  if (!verdict.allowed) return { success: false, errors: { form: [tryAgainLater(verdict.retryInMinutes)] } }

  try {
    const { user } = await authServer.api.signInEmail({ body: parsed.data, headers: await headers() })
    await clearAttempts('login', parsed.data.email)
    await rememberTimeZone(user.id)
  } catch (error) {
    // The password was right and the email still waits for its code, so the window moves to the code step.
    if (errorCode(error) === 'EMAIL_NOT_VERIFIED') {
      const { retryInSeconds } = await sendConfirmationCode(parsed.data.email)
      return { success: false, confirmEmail: { email: parsed.data.email, retryInSeconds } }
    }
    if (error instanceof APIError && error.status === 'UNAUTHORIZED') return { success: false, errors: { form: ['Wrong email or password.'] } }
    console.error('Login failed:', error)
    return { success: false, errors: { form: ['Logging in failed on our side. Try again.'] } }
  }

  redirect(safeNextPath(formData.get('next')))
}

export const registerAction = async (_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> => {
  const parsed = registerSchema.safeParse({ name: text(formData, 'name'), email: text(formData, 'email'), password: text(formData, 'password') })
  if (!parsed.success) return { success: false, errors: fieldErrors(parsed.error) }

  const { email, password } = parsed.data

  const verdict = await takeAttempts([['registerFromAddress', await visitorAddress()]])
  if (!verdict.allowed) return { success: false, errors: { form: [tryAgainLater(verdict.retryInMinutes)] } }

  try {
    const existing = await findAccountConfirmation(email)
    if (existing?.isConfirmed) return { success: false, errors: { email: ['An account with this email already exists. Log in instead.'] } }

    if (existing) {
      // Someone registered this email and never typed the code.
      if (existing.retryInSeconds > 0) {
        // The same person trying again goes straight back to the code they already received.
        if (await accountAcceptsPassword(existing.userId, password)) {
          return { success: false, confirmEmail: { email, retryInSeconds: existing.retryInSeconds } }
        }
        return {
          success: false,
          errors: { form: [`A confirmation code was sent to this email a moment ago. Try again in ${existing.retryInSeconds} seconds.`] },
        }
      }
      // The registration starts over, so the password that counts is the one typed now.
      await discardUnconfirmedAccount(existing.userId)
    }

    await authServer.api.signUpEmail({ body: parsed.data, headers: await headers() })
    const { retryInSeconds } = await sendConfirmationCode(email)
    return { success: false, confirmEmail: { email, retryInSeconds } }
  } catch (error) {
    console.error('Registration failed:', error)
    return { success: false, errors: { form: ['The account could not be created. Try again.'] } }
  }
}

// Typing the right code confirms the email and opens the session.
export const confirmEmailAction = async (_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> => {
  const parsed = confirmEmailSchema.safeParse({ email: text(formData, 'email'), password: text(formData, 'password'), code: text(formData, 'code') })
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error)
    // Only the code is typed in this step. A broken email or password means the step lost its data.
    return { success: false, errors: errors.code ? { code: errors.code } : { form: ['This step expired. Close the window and log in again.'] } }
  }

  const { email, password, code } = parsed.data

  // This step checks the password too, so its tries count as logins.
  const verdict = await takeAttempts([
    ['login', email],
    ['loginFromAddress', await visitorAddress()],
  ])
  if (!verdict.allowed) return { success: false, errors: { form: [tryAgainLater(verdict.retryInMinutes)] } }

  try {
    const account = await findAccountConfirmation(email)
    if (!account || !(await accountAcceptsPassword(account.userId, password))) {
      return { success: false, errors: { form: ['This code belongs to an older registration. Create the account again.'] } }
    }

    if (!account.isConfirmed) await authServer.api.verifyEmailOTP({ body: { email, otp: code }, headers: await headers() })
    // A confirmed account arriving here used the code in another tab. Logging in is all that is left.
    else await authServer.api.signInEmail({ body: { email, password }, headers: await headers() })
    await clearAttempts('login', email)
  } catch (error) {
    const failure = errorCode(error)
    if (failure === 'INVALID_OTP')
      return { success: false, errors: { code: ['That code does not match. Check the latest email or send a new code.'] } }
    if (failure === 'OTP_EXPIRED') return { success: false, errors: { code: ['This code expired. Send a new one.'] } }
    if (failure === 'TOO_MANY_ATTEMPTS') return { success: false, errors: { code: ['Too many wrong tries with this code. Send a new one.'] } }
    console.error('Confirming the email failed:', error)
    return { success: false, errors: { form: ['The email could not be confirmed. Try again.'] } }
  }

  redirect(safeNextPath(formData.get('next')))
}

export const resendConfirmationCodeAction = async (email: string): Promise<ConfirmationCodeDelivery> => {
  const parsed = emailField.safeParse(email)
  if (!parsed.success) return { sent: false, retryInSeconds: 0 }

  try {
    return await sendConfirmationCode(parsed.data)
  } catch (error) {
    console.error('Sending the confirmation code failed:', error)
    return { sent: false, retryInSeconds: 0 }
  }
}

export const logoutAction = async () => {
  await authServer.api.signOut({ headers: await headers() })
  redirect('/')
}

export const requestPasswordResetAction = async (_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> => {
  const parsed = z.object({ email: emailField }).safeParse({ email: text(formData, 'email') })
  if (!parsed.success) return { success: false, errors: fieldErrors(parsed.error) }

  const fromAddress = await takeAttempts([['passwordResetFromAddress', await visitorAddress()]])
  if (!fromAddress.allowed) return { success: false, errors: { form: [tryAgainLater(fromAddress.retryInMinutes)] } }

  // Past the limit of one email nothing more is sent, with the same answer, so the limit does not tell whether the account exists.
  const forEmail = await takeAttempt('passwordReset', parsed.data.email)
  if (forEmail.allowed) {
    try {
      await authServer.api.requestPasswordReset({ body: { email: parsed.data.email } })
    } catch (error) {
      console.error('Requesting the password reset failed:', error)
    }
  }

  // The answer is the same whether the account exists or not, so nobody can find out which emails are registered.
  return { success: true }
}

// On success the window goes back to the login form, where the person uses the new password.
export const resetPasswordAction = async (_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> => {
  const parsed = resetPasswordSchema.safeParse({ token: text(formData, 'token'), password: text(formData, 'password') })
  if (!parsed.success) return { success: false, errors: fieldErrors(parsed.error) }

  try {
    await authServer.api.resetPassword({ body: { token: parsed.data.token, newPassword: parsed.data.password } })
  } catch (error) {
    if (!(error instanceof APIError)) console.error('Resetting the password failed:', error)
    return { success: false, errors: { form: ['This link expired or was already used. Request a new one.'] } }
  }

  return { success: true }
}
