import { Resend } from 'resend'

import { absoluteUrl, authModalPath } from '+/lib/redirects'

const FONT_STACK = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

// Notices about a practice someone signed up for. See src/lib/practiceNotices.ts.
export type PracticeNoticeKind = 'practice confirmed' | 'spot freed' | 'practice cancelled' | 'practice moved' | 'poll decided'

type OutgoingEmail = {
  // Names the email in the server log. The subject stays out of the log because it can carry the confirmation code.
  kind: 'password reset' | 'email confirmation' | PracticeNoticeKind
  to: string
  subject: string
  html: string
  // What the terminal shows in development when no email provider is configured, so the flow can still be tried.
  developmentNote: string
}

// The browser tests read the emails from a file instead of an inbox. It only works outside production.
const writeToTestOutbox = async (email: Omit<OutgoingEmail, 'developmentNote'>) => {
  const outbox = process.env.EMAIL_OUTBOX
  if (!outbox || process.env.NODE_ENV === 'production') return false
  const { appendFile } = await import('node:fs/promises')
  await appendFile(outbox, `${JSON.stringify({ ...email, sentAt: new Date().toISOString() })}\n`)
  return true
}

const deliver = async ({ kind, to, subject, html, developmentNote }: OutgoingEmail) => {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.FROM_EMAIL

  if (await writeToTestOutbox({ kind, to, subject, html })) return

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
  const resetUrl = absoluteUrl(authModalPath('reset', { token }))

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

// Titles and names are typed by people, so they are escaped before they go into the HTML of an email.
const escapeHtml = (text: string) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')

type PracticeNotice = {
  kind: PracticeNoticeKind
  to: string
  subject: string
  heading: string
  // Each one becomes a paragraph.
  paragraphs: string[]
  // The button at the end, when there is a page to open.
  action?: { label: string; href: string }
}

export const sendPracticeNotice = async ({ kind, to, subject, heading, paragraphs, action }: PracticeNotice) => {
  const body = paragraphs.map((text) => `<p style="font-size: 16px; line-height: 1.5; margin: 0 0 16px;">${escapeHtml(text)}</p>`).join('')
  const button = action
    ? `<p style="margin: 24px 0 0;"><a href="${escapeHtml(action.href)}" style="display: inline-block; background: #2440d8; color: #ffffff; text-decoration: none; font-weight: 600; padding: 12px 20px; border-radius: 8px;">${escapeHtml(action.label)}</a></p>`
    : ''

  await deliver({
    kind,
    to,
    subject,
    developmentNote: `${subject} (to ${to})`,
    html: emailLayout(escapeHtml(heading), body + button),
  })
}
