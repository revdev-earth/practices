import { notFound, redirect } from 'next/navigation'

import { getUser } from '+/lib/auth'
import { practiceIcsFile, practiceIcsFileName } from '+/lib/calendarInvite'
import { getPractice } from '+/lib/practices'
import { authModalPath, practicePath } from '+/lib/redirects'

// The practice as a calendar file, for anyone with an account.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getUser()
  if (!user) redirect(authModalPath('login', { next: practicePath(id) }))

  const practice = await getPractice(id, user.id)
  if (!practice) notFound()

  return new Response(practiceIcsFile(practice, 'member'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${practiceIcsFileName(practice)}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
