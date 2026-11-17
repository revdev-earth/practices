'use client'

import { startTransition, useActionState, type FormEvent } from 'react'

// Submits a form to a server action and keeps what was typed on screen when the action answers with errors.
// A form wired through its `action` prop is cleared by React after every submit.
export const useFormAction = <State>(
  action: (state: Awaited<State>, formData: FormData) => Promise<State>,
  initialState: Awaited<State>,
  prepare?: (formData: FormData) => void
) => {
  const [state, dispatch, isPending] = useActionState(action, initialState)

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    prepare?.(formData)
    startTransition(() => dispatch(formData))
  }

  return { state, onSubmit, isPending }
}
