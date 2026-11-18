'use client'

import { ArrowRight, User } from 'lucide-react'

import { enterAsGuestAction, type GuestEntryState } from '+/actions/guests'
import Field from '+/components/Field'
import FormError from '+/components/FormError'
import { IconInput } from '+/components/IconInput'
import { useFormAction } from '+/hooks/useFormAction'
import { GUEST_NAME_LIMITS } from '+/lib/practiceRules'

import VideoRoom from '../../../practices/_/VideoRoom'

const initialState: GuestEntryState = { success: false }

type GuestRoomProps = {
  practiceId: string
  leaveHref: string
  // The name of the spot this browser holds. With it the guest enters straight away, without typing a name.
  listedName: string | null
}

// The name form of a guest and, once the room let them in, the call itself.
export default function GuestRoom({ practiceId, leaveHref, listedName }: GuestRoomProps) {
  const { state, onSubmit, isPending } = useFormAction(enterAsGuestAction.bind(null, practiceId), initialState)

  if (state.success && state.entry) {
    return (
      <div className="mt-4 overflow-hidden rounded-lg">
        <VideoRoom serverUrl={state.entry.serverUrl} token={state.entry.token} leaveHref={leaveHref} practiceId={practiceId} isHost={false} />
      </div>
    )
  }

  if (listedName) {
    return (
      <form onSubmit={onSubmit} noValidate className="mt-4 space-y-3">
        <FormError message={state.error} />
        <button type="submit" disabled={isPending} className="button button-primary">
          {isPending ? 'Opening the room…' : `Enter the room as ${listedName}`}
          {!isPending && <ArrowRight className="size-5" aria-hidden="true" />}
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-4 space-y-4">
      <Field label="Name for the call" htmlFor="guest-name">
        <IconInput
          icon={User}
          id="guest-name"
          name="name"
          type="text"
          autoComplete="name"
          maxLength={GUEST_NAME_LIMITS.max}
          placeholder="Jane"
          required
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? 'guest-name-error' : undefined}
        />
      </Field>
      <FormError message={state.error} />
      <button type="submit" disabled={isPending} className="button button-primary">
        {isPending ? 'Opening the room…' : 'Enter the room'}
        {!isPending && <ArrowRight className="size-5" aria-hidden="true" />}
      </button>
    </form>
  )
}
