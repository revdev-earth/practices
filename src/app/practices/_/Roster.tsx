import type { Participant, PracticeView } from '+/lib/practices'

import RemoveGuestButton from './RemoveGuestButton'

// Up to this size the sheet shows every line. Bigger groups show the lines up to the minimum and sum up the rest.
const LARGEST_SHEET_DRAWN_IN_FULL = 12

const ParticipantName = ({ person }: { person: Participant }) => (
  <>
    <span className="truncate">{person.name}</span>
    {person.isOrganizer && <span className="shrink-0 text-xs font-medium text-muted">host</span>}
    {person.isGuest && <span className="shrink-0 text-xs font-medium text-muted">not registered</span>}
    {person.isViewer && <span className="shrink-0 text-xs font-medium text-muted">you</span>}
  </>
)

// The sign-up sheet: numbered lines in arrival order, the line where the practice gets confirmed, and the waitlist below.
export default function Roster({ practice }: { practice: PracticeView }) {
  const { confirmed, waiting, minParticipants: minimum, maxParticipants: maximum } = practice
  const taken = confirmed.length
  const isPast = practice.status === 'past'

  // The host can take people without an account off the sheet while the practice is ahead.
  const removeButton = (person: Participant) =>
    practice.viewer.isOrganizer && person.isGuest && !isPast ? (
      <RemoveGuestButton practiceId={practice.id} guestSignupId={person.id.replace(/^guest:/, '')} name={person.name} />
    ) : null

  const lastLineDrawn = isPast ? taken : maximum <= LARGEST_SHEET_DRAWN_IN_FULL ? maximum : Math.min(maximum, Math.max(minimum, taken + 1))
  const freeLinesLeftOut = isPast ? 0 : maximum - lastLineDrawn
  const lineNumbers = Array.from({ length: lastLineDrawn }, (_, index) => index + 1)

  return (
    <section aria-labelledby="roster-heading" className="rounded-xl border border-line bg-sheet">
      <div className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-3">
        <h2 id="roster-heading" className="font-display text-xl font-semibold">
          Sign-up sheet
        </h2>
        <p className="text-sm text-muted tabular-nums">
          {taken} of {maximum}
        </p>
      </div>

      <ol>
        {lineNumbers.map((lineNumber) => {
          const person = confirmed[lineNumber - 1]
          const isMinimumLine = lineNumber === minimum && minimum < maximum
          return (
            <li
              key={lineNumber}
              className={`flex min-h-11 items-center gap-3 border-t px-5 py-2 ${isMinimumLine ? 'border-b-2 border-t-line border-b-ink' : 'border-line'}`}
            >
              <span className="w-6 shrink-0 text-sm text-muted tabular-nums">{lineNumber}</span>
              {person ? (
                <>
                  <span className="flex min-w-0 items-baseline gap-2 font-semibold text-pen">
                    <ParticipantName person={person} />
                  </span>
                  {removeButton(person)}
                </>
              ) : (
                <span className="sr-only">Free spot</span>
              )}
              {/* Once someone fills the line, the heavy rule and the status of the practice already say it is confirmed. */}
              {isMinimumLine && !isPast && !person && (
                <span className="ml-auto shrink-0 pl-2 text-right text-xs text-muted">Confirmed once this line is filled</span>
              )}
            </li>
          )
        })}
      </ol>

      {freeLinesLeftOut > 0 && (
        <p className="border-t border-line px-5 py-3 text-sm text-muted">
          {freeLinesLeftOut} more {freeLinesLeftOut === 1 ? 'spot' : 'spots'} below this line.
        </p>
      )}

      {isPast && taken === 0 && <p className="border-t border-line px-5 py-3 text-sm text-muted">Nobody was signed up.</p>}

      {waiting.length > 0 && (
        <div className="border-t border-line bg-desk/50 pb-2">
          <h3 className="px-5 pt-4 pb-2 text-sm font-semibold">Waitlist</h3>
          <ol>
            {waiting.map((person, index) => (
              <li key={person.id} className="flex min-h-10 items-center gap-3 px-5 py-1.5">
                <span className="w-6 shrink-0 text-sm text-muted tabular-nums">{maximum + index + 1}</span>
                <span className="flex min-w-0 items-baseline gap-2 font-medium">
                  <ParticipantName person={person} />
                </span>
                {removeButton(person)}
              </li>
            ))}
          </ol>
          <p className="px-5 pt-1 pb-2 text-xs text-muted">Whoever is first here takes the next spot that frees up.</p>
        </div>
      )}
    </section>
  )
}
