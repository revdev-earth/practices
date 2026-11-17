import type { PracticeView } from '+/lib/practices'
import type { PracticeStatus } from '+/lib/practiceRules'

// The highlighter color of each status. The calendar marks use the same ones.
export const HIGHLIGHT: Record<PracticeStatus, string> = {
  open: 'highlight-yellow',
  confirmed: 'highlight-green',
  full: 'highlight-pink',
  past: 'highlight-plain',
}

export const statusText = ({ status, missing }: Pick<PracticeView, 'status' | 'missing'>) => {
  if (status === 'open') return `Needs ${missing} more`
  if (status === 'confirmed') return 'Confirmed'
  if (status === 'full') return 'Full'
  return 'Ended'
}

type StatusMarkProps = {
  practice: Pick<PracticeView, 'status' | 'missing'>
  drawn?: boolean
}

// The status of a practice, written with a highlighter.
export default function StatusMark({ practice, drawn = false }: StatusMarkProps) {
  return <span className={`highlight ${HIGHLIGHT[practice.status]} ${drawn ? 'highlight-drawn' : ''} text-sm`}>{statusText(practice)}</span>
}
