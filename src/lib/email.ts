import { Resend } from 'resend'

import { authModalPath } from '+/lib/redirects'

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

const FONT_STACK = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

type OutgoingEmail = {
  // Names the email in the server log. The subject stays out of the log because it can carry the confirmation code.
  kind: 'password reset' | 'email confirmation'
  to: string
  subject: string
  html: string
  // What the terminal shows in development when no email provider is configured, so the flow can still be tried.
  developmentNote: string
}

const deliver = async ({ kind, to, subject, html, developmentNote }: OutgoingEmail) => {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.FROM_EMAIL

  if (!apiKey || !from) {
    if (process.env.NODE_ENV !== 'production') console.log(`🔐 ${developmentNote}`)
    else console.error(`The ${kind} email was not sent: RESEND_API_KEY or FROM_EMAIL is missing`)
    return
  }

  const { error } = await new Resend(apiKey).emails.send({ from, to: process.env.RESEND_EMAIL_TEST || to, subject, html })
  if (error) console.error(`The ${kind} email could not be sent:`, error)
}

const emailLayout = (heading: string, body: string) => `
  <div style="font-family: ${FONT_STACK}; color: #151b33; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
    <h1 style="font-size: 22px; margin: 0 0 16px;">${heading}</h1>
    ${body}
  </div>
`

export const sendPasswordResetEmail = async (email: string, token: string) => {
  // The link opens the landing page with the new password form on top.
  const resetUrl = `${appUrl()}${authModalPath('reset', { token })}`

  await deliver({
    kind: 'password reset',
    to: email,
    subject: 'Reset your Practices password',
    developmentNote: `Password reset link for ${email}: ${resetUrl}`,
    html: emailLayout(
      'Reset your password',
      `
        <p style="font-size: 16px; line-height: 1.5; margin: 0 0 24px;">You asked to change the password of your Practices account. The link works for one hour.</p>
        <p style="margin: 0 0 24px;">
          <a href="${resetUrl}" style="display: inline-block; background: #2440d8; color: #ffffff; text-decoration: none; font-weight: 600; padding: 12px 20px; border-radius: 8px;">Choose a new password</a>
        </p>
        <p style="font-size: 14px; line-height: 1.5; color: #5a6282; margin: 0;">If you did not ask for this, ignore this email. Your password stays the same.</p>
      `
    ),
  })
}

export const sendEmailConfirmationCode = async (email: string, code: string, validForMinutes: number) => {
  await deliver({
    kind: 'email confirmation',
    to: email,
    subject: `${code} is your Practices confirmation code`,
    developmentNote: `Email confirmation code for ${email}: ${code}`,
    html: emailLayout(
      'Confirm your email',
      `
        <p style="font-size: 16px; line-height: 1.5; margin: 0 0 20px;">Type this code in the Practices window where you created your account. It works for ${validForMinutes} minutes.</p>
        <p style="font-size: 34px; font-weight: 700; letter-spacing: 8px; color: #2440d8; margin: 0 0 24px;">${code}</p>
        <p style="font-size: 14px; line-height: 1.5; color: #5a6282; margin: 0;">If you did not create a Practices account, ignore this email. Without the code the account stays closed.</p>
      `
    ),
  })
}
