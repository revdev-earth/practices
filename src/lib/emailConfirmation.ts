import { verifyPassword } from 'better-auth/crypto'

import { authServer } from '+/lib/auth'
import { prisma } from '+/lib/prisma'

// A code allows three tries. Spacing the codes out keeps guessing slow and keeps an inbox from being flooded.
export const CONFIRMATION_CODE_COOLDOWN_SECONDS = 60

export type AccountConfirmation = {
  userId: string
  isConfirmed: boolean
  // Seconds before this email can receive another code.
  retryInSeconds: number
}

export const findAccountConfirmation = async (email: string): Promise<AccountConfirmation | null> => {
  const account = await prisma.user.findUnique({ where: { email }, select: { id: true, emailVerified: true, confirmationCodeSentAt: true } })
  if (!account) return null

  const secondsSinceLastCode = account.confirmationCodeSentAt ? Math.floor((Date.now() - account.confirmationCodeSentAt.getTime()) / 1000) : Infinity
  return {
    userId: account.id,
    isConfirmed: account.emailVerified,
    retryInSeconds: Math.max(CONFIRMATION_CODE_COOLDOWN_SECONDS - secondsSinceLastCode, 0),
  }
}

export type ConfirmationCodeDelivery = {
  // False inside the cooldown: nothing went out and the code from the last email keeps working.
  sent: boolean
  // Seconds before another code can be requested.
  retryInSeconds: number
}

// Sends a fresh confirmation code to an account that is still waiting for it.
export const sendConfirmationCode = async (email: string): Promise<ConfirmationCodeDelivery> => {
  const account = await findAccountConfirmation(email)
  // An unknown or already confirmed email gets the same answer and no email, so the answer gives nothing away.
  if (!account || account.isConfirmed) return { sent: false, retryInSeconds: CONFIRMATION_CODE_COOLDOWN_SECONDS }
  if (account.retryInSeconds > 0) return { sent: false, retryInSeconds: account.retryInSeconds }

  await prisma.user.update({ where: { id: account.userId }, data: { confirmationCodeSentAt: new Date() } })
  await authServer.api.sendVerificationOTP({ body: { email, type: 'email-verification' } })

  return { sent: true, retryInSeconds: CONFIRMATION_CODE_COOLDOWN_SECONDS }
}

// The code proves who reads the inbox and the password proves who created the account.
// Asking for both keeps someone from registering a stranger's email and waiting for the owner to confirm it.
export const accountAcceptsPassword = async (userId: string, password: string) => {
  const credential = await prisma.account.findFirst({ where: { userId, providerId: 'credential' }, select: { password: true } })
  if (!credential?.password) return false
  return verifyPassword({ hash: credential.password, password })
}

// An account that never typed its code cannot log in, so it owns no practices and no signups and can be created again from scratch.
export const discardUnconfirmedAccount = async (userId: string) => {
  await prisma.user.deleteMany({ where: { id: userId, emailVerified: false } })
}
