'use client'

import { User } from 'lucide-react'
import { useState, useTransition } from 'react'

import { leaveGuestSpotAction, takeGuestSpotAction, type GuestSpotState } from '+/actions/guests'
import Field from '+/components/Field'
import FormError from '+/components/FormError'
import { IconInput } from '+/components/IconInput'
import { useFormAction } from '+/hooks/useFormAction'
import { GUEST_NAME_LIMITS } from '+/lib/practiceRules'

const initialState: GuestSpotState = { success: false }

type GuestSpotProps = {
  practiceId: string
  // The spot this browser holds, if any.
  spot: { name: string; place: 'confirmed' | 'waiting' } | null
  isFull: boolean
}

// A spot on the sheet without an account: a name is enough. The browser keeps it, so it can give it back later.
export default function GuestSpot({ practiceId, spot, isFull }: GuestSpotProps) {
  const { state, onSubmit, isPending } = useFormAction(takeGuestSpotAction.bind(null, practiceId), initialState)
  const [isLeaving, startLeaving] = useTransition()
  const [leaveError, setLeaveError] = useState<string | null>(null)

  if (spot) {
    return (
      <div>
        <p className="font-semibold">
          {spot.place === 'confirmed'
            ? `You have a spot as ${spot.name}, not registered.`
            : `You are on the waitlist as ${spot.name}, not registered. You move up when a spot frees up.`}
        </p>
        <p className="mt-1 text-sm text-muted">This browser keeps your spot. Use it to come back here or to give the spot back.</p>
        <button
          type="button"
          className="button button-quiet mt-3"
          disabled={isLeaving}
          onClick={() =>
            startLeaving(async () => {
              const result = await leaveGuestSpotAction(practiceId)
              setLeaveError(result.success ? null : (result.error ?? 'The spot could not be given back. Try again.'))
            })
          }
        >
          {spot.place === 'confirmed' ? 'Give the spot back' : 'Leave the waitlist'}
        </button>
        {leaveError && (
          <p role="alert" className="mt-2 text-sm font-medium text-danger">
            {leaveError}
          </p>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <p className="font-semibold">{isFull ? 'Every spot is taken. Join the waitlist with your name.' : 'Take a spot with just your name.'}</p>
      <Field label="Your name" htmlFor="guest-spot-name" hint="The sheet shows it as not registered.">
        <IconInput
          icon={User}
          id="guest-spot-name"
          name="name"
          type="text"
          autoComplete="name"
          maxLength={GUEST_NAME_LIMITS.max}
          required
          aria-invalid={Boolean(state.error)}
        />
      </Field>
      <FormError message={state.error} />
      <button type="submit" disabled={isPending} className="button button-primary">
        {isPending ? 'Saving…' : isFull ? 'Join the waitlist' : 'Take a spot'}
      </button>
    </form>
  )
}
