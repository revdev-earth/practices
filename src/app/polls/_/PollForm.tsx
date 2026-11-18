'use client'

import { Plus, X } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { createTimePollAction, type PollFormState } from '+/actions/polls'
import Field from '+/components/Field'
import FormError from '+/components/FormError'
import { useFormAction } from '+/hooks/useFormAction'
import { formatDuration } from '+/lib/dates'
import { DURATION_OPTIONS, PRACTICE_LIMITS } from '+/lib/practiceRules'
import { POLL_OPTION_LIMITS } from '+/lib/timePolls'

const initialState: PollFormState = { success: false }

// Each datetime-local has no zone. The browser knows it, so every proposed time becomes an exact instant before it is sent.
const sendTimesAsExactInstants = (formData: FormData) => {
  const times = formData.getAll('optionsLocal').map(String)
  formData.delete('optionsLocal')
  for (const time of times) {
    const start = new Date(time)
    formData.append('options', Number.isNaN(start.getTime()) ? '' : start.toISOString())
  }
}

type PollFormProps = {
  // Wall clock times in the viewer's zone, as a datetime-local input expects them.
  suggestedTimes: string[]
  // "Bogota (GMT-5)".
  viewerZone: string
}

let nextRowKey = 0
const newRow = (value: string) => ({ key: nextRowKey++, value })

export default function PollForm({ suggestedTimes, viewerZone }: PollFormProps) {
  const { state, onSubmit, isPending } = useFormAction(createTimePollAction, initialState, sendTimesAsExactInstants)
  const [rows, setRows] = useState(() => suggestedTimes.map(newRow))
  const errors = state.errors ?? {}

  const addTime = () => setRows([...rows, newRow(rows[rows.length - 1]?.value ?? '')])
  const removeTime = (key: number) => setRows(rows.filter((row) => row.key !== key))

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Field label="Title" htmlFor="poll-title" error={errors.title?.[0]}>
        <input
          id="poll-title"
          name="title"
          type="text"
          maxLength={PRACTICE_LIMITS.title.max}
          placeholder="Mock interviews for frontend roles"
          required
          aria-invalid={Boolean(errors.title)}
          className="field-input"
        />
      </Field>

      <Field
        label="Description"
        htmlFor="poll-description"
        hint="What the group will practice. It goes into the practice once the time is chosen."
        error={errors.description?.[0]}
      >
        <textarea id="poll-description" name="description" maxLength={PRACTICE_LIMITS.description.max} rows={3} className="field-input resize-y" />
      </Field>

      <Field label="Duration" htmlFor="poll-duration" error={errors.durationMin?.[0]}>
        <select id="poll-duration" name="durationMin" defaultValue={60} className="field-input sm:w-44">
          {DURATION_OPTIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {formatDuration(minutes)}
            </option>
          ))}
        </select>
      </Field>

      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">Times to choose from</legend>
        <p className="mb-3 text-sm text-muted">
          In your time zone, {viewerZone}. Everyone sees them in their own. From {POLL_OPTION_LIMITS.min} to {POLL_OPTION_LIMITS.max} times.
        </p>
        <ol className="space-y-2">
          {rows.map((row, index) => (
            <li key={row.key} className="flex items-center gap-2">
              <input
                type="datetime-local"
                name="optionsLocal"
                aria-label={`Time ${index + 1}`}
                value={row.value}
                onChange={(event) => setRows(rows.map((item) => (item.key === row.key ? { ...item, value: event.target.value } : item)))}
                required
                className="field-input"
              />
              <button
                type="button"
                onClick={() => removeTime(row.key)}
                disabled={rows.length <= POLL_OPTION_LIMITS.min}
                aria-label={`Remove time ${index + 1}`}
                className="button button-quiet px-2.5"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
        {rows.length < POLL_OPTION_LIMITS.max && (
          <button type="button" onClick={addTime} className="button button-quiet mt-3">
            <Plus className="size-4" aria-hidden="true" />
            Add a time
          </button>
        )}
        {errors.options?.[0] && <p className="mt-2 text-sm font-medium text-danger">{errors.options[0]}</p>}
      </fieldset>

      <FormError message={errors.form?.[0]} />

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={isPending} className="button button-primary">
          {isPending ? 'Creating…' : 'Create poll'}
        </button>
        <Link href="/polls" className="button button-quiet">
          Cancel
        </Link>
      </div>
    </form>
  )
}
