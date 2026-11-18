import { notFound } from 'next/navigation'

import { practiceIcsFile, practiceIcsFileName } from '+/lib/calendarInvite'
import { getPractice } from '+/lib/practices'

// The calendar file of a public practice, for people with no account. A private practice answers 404, like its page.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const practice = await getPractice(id, '')
  if (!practice || !practice.isPublic) notFound()

  return new Response(practiceIcsFile(practice, 'guest'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${practiceIcsFileName(practice)}"`,
      'Cache-Control': 'no-store',
    },
  })
}
