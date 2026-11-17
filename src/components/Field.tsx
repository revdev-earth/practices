import type { ReactNode } from 'react'

type FieldProps = {
  label: string
  htmlFor: string
  hint?: string
  error?: string
  children: ReactNode
}

// Label, control, hint and error of one form field. The control links to the messages through `${htmlFor}-hint` and `${htmlFor}-error`.
export default function Field({ label, htmlFor, hint, error, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} className="mt-1.5 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

export const describedBy = (id: string, { hint, error }: { hint?: string; error?: string }) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined
