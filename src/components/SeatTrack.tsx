import { Fragment } from 'react'

// Above this size the spots are too small to tell apart, so the track becomes one proportional bar.
const LARGEST_GROUP_DRAWN_SPOT_BY_SPOT = 16

type SeatTrackProps = {
  taken: number
  minimum: number
  maximum: number
}

// One mark per spot, filled in pen blue as people join, with a tick where the practice gets confirmed.
export default function SeatTrack({ taken, minimum, maximum }: SeatTrackProps) {
  const label = `${taken} of ${maximum} spots taken, ${minimum} needed to confirm`
  const showsMinimumTick = minimum < maximum

  if (maximum > LARGEST_GROUP_DRAWN_SPOT_BY_SPOT) {
    return (
      <div role="img" aria-label={label} className="relative h-2.5 w-44 rounded-[3px] border border-muted/45 bg-sheet">
        <div className="h-full rounded-[2px] bg-pen" style={{ width: `${(taken / maximum) * 100}%` }} />
        {showsMinimumTick && <span className="absolute -top-1 h-4 w-0.5 bg-ink" style={{ left: `${(minimum / maximum) * 100}%` }} />}
      </div>
    )
  }

  return (
    <div role="img" aria-label={label} className="flex items-center gap-[3px]">
      {Array.from({ length: maximum }, (_, index) => (
        <Fragment key={index}>
          <span className={`h-2.5 w-3.5 rounded-[3px] ${index < taken ? 'bg-pen' : 'border border-muted/45 bg-sheet'}`} />
          {showsMinimumTick && index + 1 === minimum && <span className="mx-px h-4 w-0.5 bg-ink" />}
        </Fragment>
      ))}
    </div>
  )
}
