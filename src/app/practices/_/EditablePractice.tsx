'use client'

import { Pencil } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import type { PracticeFormState } from '+/actions/practices'

import PracticeForm, { type PracticeFormDefaults } from './PracticeForm'

type EditablePracticeProps = {
  // Only the organizer of a practice that has not ended can edit it.
  canEdit: boolean
  statusMark: ReactNode
  // The practice as it reads: title, when, where, host and description.
  details: ReactNode
  action: (state: PracticeFormState, formData: FormData) => Promise<PracticeFormState>
  defaults: PracticeFormDefaults
  viewerZone: string
}

// The top of the practice sheet. The pencil in the header turns the details into the form in the same place.
export default function EditablePractice({ canEdit, statusMark, details, action, defaults, viewerZone }: EditablePracticeProps) {
  const [isEditing, setIsEditing] = useState(false)

  // A saved practice goes back to reading, with the page already refreshed by the action.
  const save = async (previousState: PracticeFormState, formData: FormData) => {
    const result = await action(previousState, formData)
    if (result.success) setIsEditing(false)
    return result
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        {statusMark}
        {canEdit && !isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            aria-label="Edit practice"
            title="Edit practice"
            className="-mt-1 -mr-2 grid size-10 place-items-center rounded-lg text-muted hover:bg-desk hover:text-ink"
          >
            <Pencil className="size-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="modal-step mt-5">
          <PracticeForm
            action={save}
            defaults={defaults}
            viewerZone={viewerZone}
            submitLabel="Save changes"
            pendingLabel="Saving…"
            onCancel={() => setIsEditing(false)}
          />
        </div>
      ) : (
        details
      )}
    </>
  )
}
