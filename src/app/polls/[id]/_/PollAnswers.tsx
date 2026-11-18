'use client'

import { User } from 'lucide-react'

import { answerTimePollAction, type PollFormState } from '+/actions/polls'
import Field from '+/components/Field'
import FormError from '+/components/FormError'
import { IconInput } from '+/components/IconInput'
import { useFormAction } from '+/hooks/useFormAction'
import { GUEST_NAME_LIMITS } from '+/lib/practiceRules'
import { ANSWER_LABELS, POLL_ANSWERS, type PollAnswer } from '+/lib/timePolls'

const initialState: PollFormState = { success: false }

const ANSWER_STYLE: Record<PollAnswer, string> = {
  YES: 'peer-checked:bg-highlight-green',
  IF_NEEDED: 'peer-checked:bg-highlight-yellow',
  NO: 'peer-checked:bg-desk',
}

type PollAnswersProps = {
  pollId: string
  // Each time as the viewer reads it, already formatted in their zone.
  options: { id: string; label: string }[]
  answers: Record<string, PollAnswer>
  // Without an account the person types the name others see. With one, the name of the account is used.
  asGuest: boolean
  guestName: string
}

// The answers of the person looking at the poll: yes, if needed or no for every time.
export default function PollAnswers({ pollId, options, answers, asGuest, guestName }: PollAnswersProps) {
  const { state, onSubmit, isPending } = useFormAction(answerTimePollAction.bind(null, pollId), initialState)
  const errors = state.errors ?? {}
  const hasAnswered = Object.keys(answers).length > 0

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {asGuest && (
        <Field label="Your name" htmlFor="poll-voter-name" hint="Others see it next to your answers." error={errors.name?.[0]}>
          <IconInput
            icon={User}
            id="poll-voter-name"
            name="name"
            type="text"
            autoComplete="name"
            defaultValue={guestName}
            maxLength={GUEST_NAME_LIMITS.max}
            required
            aria-invalid={Boolean(errors.name)}
          />
        </Field>
      )}

      <ul className="divide-y divide-line rounded-xl border border-line">
        {options.map((option) => (
          <li key={option.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
            <span className="font-medium tabular-nums">{option.label}</span>
            <fieldset className="flex gap-1.5">
              <legend className="sr-only">{option.label}</legend>
              {POLL_ANSWERS.map((answer) => (
                <label key={answer} className="cursor-pointer">
                  <input
                    type="radio"
                    name={`answer-${option.id}`}
                    value={answer}
                    defaultChecked={(answers[option.id] ?? 'NO') === answer}
                    className="peer sr-only"
                  />
                  <span
                    className={`inline-block rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-muted peer-checked:border-transparent peer-checked:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-pen ${ANSWER_STYLE[answer]}`}
                  >
                    {ANSWER_LABELS[answer]}
                  </span>
                </label>
              ))}
            </fieldset>
          </li>
        ))}
      </ul>

      <FormError message={errors.form?.[0]} />
      {state.success && (
        <p role="status" className="text-sm font-medium">
          Your answers are saved.{asGuest ? ' You can change them from this browser.' : ''}
        </p>
      )}

      <button type="submit" disabled={isPending} className="button button-primary">
        {isPending ? 'Saving…' : hasAnswered ? 'Update my answers' : 'Save my answers'}
      </button>
    </form>
  )
}
