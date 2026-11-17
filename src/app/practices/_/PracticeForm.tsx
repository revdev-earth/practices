'use client'

import Link from 'next/link'
import { useState } from 'react'

import type { PracticeFormState } from '+/actions/practices'
import Field from '+/components/Field'
import FormError from '+/components/FormError'
import { useFormAction } from '+/hooks/useFormAction'
import { formatDuration } from '+/lib/dates'
import { DURATION_OPTIONS, MODE_LABELS, PRACTICE_LIMITS, PRACTICE_MODES, type PracticeMode } from '+/lib/practiceRules'

export type PracticeFormDefaults = {
  title: string
  description: string
  // Wall clock time in the viewer's zone, as a datetime-local input expects it.
  startsAtLocal: string
  durationMin: number
  mode: PracticeMode
  location: string
  minParticipants: number
  maxParticipants: number
}

type PracticeFormProps = {
  action: (state: PracticeFormState, formData: FormData) => Promise<PracticeFormState>
  defaults: PracticeFormDefaults
  // "Bogota (GMT-5)": tells the person which zone the time they type belongs to.
  viewerZone: string
  submitLabel: string
  pendingLabel: string
  // Where Cancel goes, or what it does when the form lives inside another page.
  cancelHref?: string
  onCancel?: () => void
}

const LOCATION_FIELD: Record<PracticeMode, { label: string; placeholder: string; hint: string }> = {
  ONLINE: { label: 'Call link', placeholder: 'https://', hint: 'Optional. It can be added later.' },
  IN_PERSON: { label: 'Place', placeholder: 'Community room, 12 Mill Street', hint: 'Optional. It can be added later.' },
}

const initialState: PracticeFormState = { success: false }

// A datetime-local input has no zone. The browser knows it, so the wall clock time becomes an exact instant before it is sent.
const sendStartAsExactInstant = (formData: FormData) => {
  const start = new Date(String(formData.get('startsAtLocal') ?? ''))
  formData.set('startsAt', Number.isNaN(start.getTime()) ? '' : start.toISOString())
  formData.delete('startsAtLocal')
}

export default function PracticeForm({ action, defaults, viewerZone, submitLabel, pendingLabel, cancelHref, onCancel }: PracticeFormProps) {
  const { state, onSubmit, isPending } = useFormAction(action, initialState, sendStartAsExactInstant)
  const [mode, setMode] = useState<PracticeMode>(defaults.mode)
  const errors = state.errors ?? {}
  const locationField = LOCATION_FIELD[mode]
  const { title, description, location, participants } = PRACTICE_LIMITS

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Field label="Title" htmlFor="title" error={errors.title?.[0]}>
        <input
          id="title"
          name="title"
          type="text"
          defaultValue={defaults.title}
          maxLength={title.max}
          placeholder="Mock interviews for frontend roles"
          required
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? 'title-error' : undefined}
          className="field-input"
        />
      </Field>

      <Field label="Description" htmlFor="description" hint="What the group will practice, the level, what to bring." error={errors.description?.[0]}>
        <textarea
          id="description"
          name="description"
          defaultValue={defaults.description}
          maxLength={description.max}
          rows={4}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? 'description-error' : 'description-hint'}
          className="field-input resize-y"
        />
      </Field>

      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_11rem]">
        <Field label="Starts" htmlFor="startsAtLocal" hint={`In your time zone, ${viewerZone}.`} error={errors.startsAt?.[0]}>
          <input
            id="startsAtLocal"
            name="startsAtLocal"
            type="datetime-local"
            defaultValue={defaults.startsAtLocal}
            required
            aria-invalid={Boolean(errors.startsAt)}
            aria-describedby={errors.startsAt ? 'startsAtLocal-error' : 'startsAtLocal-hint'}
            className="field-input"
          />
        </Field>

        <Field label="Duration" htmlFor="durationMin" error={errors.durationMin?.[0]}>
          <select
            id="durationMin"
            name="durationMin"
            defaultValue={defaults.durationMin}
            aria-invalid={Boolean(errors.durationMin)}
            aria-describedby={errors.durationMin ? 'durationMin-error' : undefined}
            className="field-input"
          >
            {DURATION_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {formatDuration(minutes)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">Where</legend>
        <div className="flex flex-wrap gap-2">
          {PRACTICE_MODES.map((option) => (
            <label
              key={option}
              className="flex items-center gap-2 rounded-lg border border-line bg-sheet px-3.5 py-2.5 font-medium has-checked:border-pen has-checked:text-pen has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-pen"
            >
              <input type="radio" name="mode" value={option} checked={mode === option} onChange={() => setMode(option)} className="accent-pen" />
              {MODE_LABELS[option]}
            </label>
          ))}
        </div>
        {errors.mode && <p className="mt-1.5 text-sm font-medium text-danger">{errors.mode[0]}</p>}
      </fieldset>

      <Field label={locationField.label} htmlFor="location" hint={locationField.hint} error={errors.location?.[0]}>
        <input
          id="location"
          name="location"
          type="text"
          defaultValue={defaults.location}
          maxLength={location.max}
          placeholder={locationField.placeholder}
          aria-invalid={Boolean(errors.location)}
          aria-describedby={errors.location ? 'location-error' : 'location-hint'}
          className="field-input"
        />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          label="Minimum to confirm"
          htmlFor="minParticipants"
          hint="With this many people the practice happens. You count as one."
          error={errors.minParticipants?.[0]}
        >
          <input
            id="minParticipants"
            name="minParticipants"
            type="number"
            inputMode="numeric"
            defaultValue={defaults.minParticipants}
            min={participants.min}
            max={participants.max}
            required
            aria-invalid={Boolean(errors.minParticipants)}
            aria-describedby={errors.minParticipants ? 'minParticipants-error' : 'minParticipants-hint'}
            className="field-input"
          />
        </Field>

        <Field
          label="Maximum group size"
          htmlFor="maxParticipants"
          hint="Whoever joins after this goes on the waitlist."
          error={errors.maxParticipants?.[0]}
        >
          <input
            id="maxParticipants"
            name="maxParticipants"
            type="number"
            inputMode="numeric"
            defaultValue={defaults.maxParticipants}
            min={participants.min}
            max={participants.max}
            required
            aria-invalid={Boolean(errors.maxParticipants)}
            aria-describedby={errors.maxParticipants ? 'maxParticipants-error' : 'maxParticipants-hint'}
            className="field-input"
          />
        </Field>
      </div>

      <FormError message={errors.form?.[0]} />

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={isPending} className="button button-primary">
          {isPending ? pendingLabel : submitLabel}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="button button-quiet">
            Cancel
          </button>
        ) : (
          <Link href={cancelHref ?? '/'} className="button button-quiet">
            Cancel
          </Link>
        )}
      </div>
    </form>
  )
}
