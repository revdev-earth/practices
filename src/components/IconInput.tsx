'use client'

import { Eye, EyeOff, Lock, type LucideIcon } from 'lucide-react'
import { useState, type ComponentProps } from 'react'

type IconInputProps = ComponentProps<'input'> & { icon: LucideIcon }

// A text field with an icon inside on the left.
export function IconInput({ icon: Icon, className = '', ...props }: IconInputProps) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted" aria-hidden="true" />
      <input {...props} className={`field-input pl-11 ${className}`} />
    </div>
  )
}

// A password field with a lock on the left and an eye on the right that shows or hides what is typed.
export function PasswordInput(props: Omit<IconInputProps, 'icon' | 'type'>) {
  const [isShown, setIsShown] = useState(false)

  return (
    <div className="relative">
      <IconInput {...props} icon={Lock} type={isShown ? 'text' : 'password'} className="pr-12" />
      <button
        type="button"
        onClick={() => setIsShown(!isShown)}
        aria-label={isShown ? 'Hide password' : 'Show password'}
        aria-pressed={isShown}
        className="absolute top-1/2 right-3 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted hover:text-ink"
      >
        {isShown ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
      </button>
    </div>
  )
}
