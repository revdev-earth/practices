import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { nextCookies } from 'better-auth/next-js'
import { emailOTP } from 'better-auth/plugins/email-otp'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'

import { sendEmailConfirmationCode, sendPasswordResetEmail } from '+/lib/email'
import { prisma } from '+/lib/prisma'
import { authModalPath } from '+/lib/redirects'

const SESSION_DAYS = 30

export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 128

export const CONFIRMATION_CODE_LENGTH = 6
export const CONFIRMATION_CODE_VALID_MINUTES = 15

export type SessionUser = {
  id: string
  name: string
  email: string
}

export const authServer = betterAuth({
  database: prismaAdapter(prisma, { provider: 'sqlite' }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.NEXT_PUBLIC_APP_URL,

  emailAndPassword: {
    enabled: true,
    minPasswordLength: MIN_PASSWORD_LENGTH,
    maxPasswordLength: MAX_PASSWORD_LENGTH,
    // An account opens only after the person types the code sent to its email.
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    // Authentication exposes no HTTP routes, so the email link points to a page of our own.
    sendResetPassword: async ({ user, token }) => sendPasswordResetEmail(user.email, token),
  },

  emailVerification: {
    // The codes go out from src/lib/emailConfirmation.ts, which limits how often one is sent.
    sendOnSignUp: false,
    sendOnSignIn: false,
    // Typing the right code also opens the session, so the person lands inside the app.
    autoSignInAfterVerification: true,
  },

  session: {
    expiresIn: SESSION_DAYS * 24 * 60 * 60,
    // Skips a database query on every request. It is revalidated every minute.
    cookieCache: { enabled: true, maxAge: 60 },
  },

  plugins: [
    emailOTP({
      otpLength: CONFIRMATION_CODE_LENGTH,
      expiresIn: CONFIRMATION_CODE_VALID_MINUTES * 60,
      // The database keeps a hash, so a leaked table gives away no working code.
      storeOTP: 'hashed',
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type === 'email-verification') await sendEmailConfirmationCode(email, otp, CONFIRMATION_CODE_VALID_MINUTES)
      },
    }),
    // Keeps its place at the end: it writes the cookies that the plugins before it set.
    nextCookies(),
  ],
})

export const getUser = cache(async (): Promise<SessionUser | null> => {
  const data = await authServer.api.getSession({ headers: await headers() })
  if (!data?.user?.id) return null

  return { id: data.user.id, name: data.user.name, email: data.user.email }
})

// For pages that only exist with a session. The proxy already redirects whoever arrives without a cookie. The real session is validated here.
export const requireUser = async (): Promise<SessionUser> => {
  const user = await getUser()
  if (!user) redirect(authModalPath('login'))
  return user
}
