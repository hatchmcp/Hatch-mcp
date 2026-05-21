'use client'

import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SecretInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  defaultVisible?: boolean
}

export const SecretInput = React.forwardRef<HTMLInputElement, SecretInputProps>(
  ({ className, defaultVisible = false, ...props }, ref) => {
    const [visible, setVisible] = React.useState(defaultVisible)

    return (
      <div
        className={cn(
          'flex w-full rounded-sm border border-border bg-bg overflow-hidden',
          'focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent/10',
          'transition-colors',
          className
        )}
      >
        <input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn(
            'flex-1 h-10 px-3 bg-transparent text-sm text-text-primary',
            'placeholder:text-text-tertiary',
            'focus:outline-none',
            'font-mono'
          )}
          autoComplete="new-password"
          spellCheck={false}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="px-3 text-text-tertiary hover:text-text-primary transition-colors border-l border-border"
          aria-label={visible ? 'Hide' : 'Show'}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      </div>
    )
  }
)
SecretInput.displayName = 'SecretInput'
