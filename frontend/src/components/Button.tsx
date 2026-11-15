import type { ButtonHTMLAttributes } from 'react'
import { buttonClasses, type ButtonSize, type ButtonVariant } from './buttonClasses'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  /** DESIGN.md › Buttons › Loading: keeps its width, shows a spinner and is disabled. */
  loading?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  loading = false,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, `relative ${className}`)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {/* The label stays in the layout (invisible), so the button keeps its width. */}
      <span className={`inline-flex items-center gap-2 ${loading ? 'invisible' : ''}`}>{children}</span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 animate-spin fill-none stroke-current stroke-3">
            <circle cx="12" cy="12" r="9" className="opacity-25" />
            <path d="M21 12a9 9 0 0 0-9-9" />
          </svg>
        </span>
      )}
    </button>
  )
}
