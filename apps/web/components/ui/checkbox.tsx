'use client'

import * as React from 'react'
import { Check, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

type CheckedState = boolean | 'indeterminate'

export interface CheckboxProps {
  checked: CheckedState
  onCheckedChange: (next: boolean) => void
  disabled?: boolean
  className?: string
  'aria-label'?: string
  onClick?: React.MouseEventHandler<HTMLButtonElement>
}

export const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ checked, onCheckedChange, disabled, className, onClick, ...rest }, ref) => {
    const isChecked = checked === true
    const isIndeterminate = checked === 'indeterminate'
    const filled = isChecked || isIndeterminate

    return (
      <button
        ref={ref}
        type="button"
        role="checkbox"
        aria-checked={isIndeterminate ? 'mixed' : isChecked}
        disabled={disabled}
        onClick={(e) => {
          onClick?.(e)
          if (!e.defaultPrevented) onCheckedChange(!isChecked)
        }}
        className={cn(
          'shrink-0 inline-flex items-center justify-center size-3.5 rounded-[3px] border transition-colors outline-none',
          filled
            ? 'bg-accent border-accent'
            : 'bg-bg border-border-strong hover:border-text-tertiary',
          'focus-visible:ring-2 focus-visible:ring-accent/30',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        {...rest}
      >
        {isIndeterminate ? (
          <Minus className="size-2.5 text-accent-bg-text" strokeWidth={3} />
        ) : isChecked ? (
          <Check className="size-2.5 text-accent-bg-text" strokeWidth={3} />
        ) : null}
      </button>
    )
  }
)
Checkbox.displayName = 'Checkbox'
