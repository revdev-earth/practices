'use client'

import { X } from 'lucide-react'
import { useEffect, useRef, type MouseEvent, type ReactNode, type SyntheticEvent } from 'react'

// Length of the sheet-out animation in globals.css. The dialog closes for real once the sheet has left.
const SHEET_LEAVES_IN_MS = 200

type ModalProps = {
  isOpen: boolean
  onClose: () => void
  // What a screen reader announces when the window opens.
  label: string
  // Changes when the content is swapped for another step. The first field of the new step takes the focus.
  step: string
  children: ReactNode
}

// A sheet of paper put down on the desk: it lands with a slight tilt, follows the height of what it holds and leaves the same way.
// It is a native dialog, so the page behind stays out of reach, Escape closes it and the focus returns to where it was.
export default function Modal({ isOpen, onClose, label, step, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const pressStartedOnDesk = useRef(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      delete dialog.dataset.closing
      if (!dialog.open) dialog.showModal()
      return
    }
    if (!dialog.open) return

    const skipsMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    dialog.dataset.closing = 'true'
    const timer = setTimeout(
      () => {
        delete dialog.dataset.closing
        dialog.close()
        // The next opening measures the sheet again from its natural height.
        if (sheetRef.current) sheetRef.current.style.height = ''
      },
      skipsMotion ? 0 : SHEET_LEAVES_IN_MS
    )
    return () => clearTimeout(timer)
  }, [isOpen])

  // The sheet follows the height of its content, so moving between steps reads as one sheet changing size.
  useEffect(() => {
    const sheet = sheetRef.current
    const content = contentRef.current
    if (!sheet || !content) return

    const observer = new ResizeObserver(() => {
      if (content.offsetHeight === 0) return
      // The height of the sheet includes its border, the height of the content does not.
      const borderHeight = sheet.offsetHeight - sheet.clientHeight
      sheet.style.height = `${content.offsetHeight + borderHeight}px`
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (isOpen) dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
  }, [isOpen, step])

  // Escape asks to close. The sheet leaves with its animation instead of vanishing.
  const closeWithAnimation = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault()
    onClose()
  }

  // A click counts as "outside the sheet" only when it also started there, so dragging a text selection out of a field closes nothing.
  const closeWhenDeskIsClicked = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget && pressStartedOnDesk.current) onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label={label}
      className="modal"
      onCancel={closeWithAnimation}
      onPointerDown={(event) => {
        pressStartedOnDesk.current = event.target === event.currentTarget
      }}
      onClick={closeWhenDeskIsClicked}
    >
      <div ref={sheetRef} className="modal-sheet">
        <div ref={contentRef} className="relative">
          {children}
          <button type="button" onClick={onClose} aria-label="Close" className="modal-close">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </dialog>
  )
}
