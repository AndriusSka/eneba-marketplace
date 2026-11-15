import { useId, type InputHTMLAttributes } from 'react'

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  /** A server validation message, shown under the input and announced with it. */
  error?: string
}

/** DESIGN.md › Checkout: `text-sm` 600 label above a `field` input; errors in `danger`. */
export function TextField({ label, error, id, className = '', ...rest }: TextFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const errorId = `${inputId}-error`

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={inputId} className="text-sm font-semibold text-fg">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="h-10 rounded-sm border border-line bg-field px-3 text-sm text-fg placeholder:text-fg-muted aria-invalid:border-danger"
        {...rest}
      />
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
