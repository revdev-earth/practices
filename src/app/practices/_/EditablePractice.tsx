'use client'

import { Pencil, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import type { PracticeFormState } from '+/actions/practices'

import DeletePracticeConfirmation from './DeletePracticeConfirmation'
import PracticeForm, { type PracticeFormDefaults } from './PracticeForm'

type EditablePracticeProps = {
  practiceId: string
  // The organizer can delete a practice, even after it ended.
  canDelete: boolean
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
export default function EditablePractice({
  practiceId,
  canDelete,
  canEdit,
  statusMark,
  details,
  action,
  defaults,
  viewerZone,
}: EditablePracticeProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

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
        <div className="-mt-1 -mr-2 flex items-center">
          {canEdit && !isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              aria-label="Edit practice"
              title="Edit practice"
              className="grid size-10 place-items-center rounded-lg text-muted hover:bg-desk hover:text-ink"
            >
              <Pencil className="size-5" aria-hidden="true" />
            </button>
          )}
          {canDelete && !isEditing && (
            <button
              type="button"
              onClick={() => setIsConfirmingDelete(!isConfirmingDelete)}
              aria-label="Delete practice"
              aria-expanded={isConfirmingDelete}
              title="Delete practice"
              className="grid size-10 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"
            >
              <Trash2 className="size-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {isConfirmingDelete && !isEditing && <DeletePracticeConfirmation practiceId={practiceId} onKeep={() => setIsConfirmingDelete(false)} />}

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
