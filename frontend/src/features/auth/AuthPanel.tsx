import type { FormEvent, ReactNode } from 'react'
import { Button } from '../../components/Button'
import { CONTAINER } from '../../components/Layout'

type AuthPanelProps = {
  title: string
  submitLabel: string
  pending: boolean
  formError: string | null
  onSubmit: () => void
  footer: ReactNode
  children: ReactNode
}

/** Shared frame of the sign-in and register pages: a `surface-panel` card with the form. */
export function AuthPanel({ title, submitLabel, pending, formError, onSubmit, footer, children }: AuthPanelProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!pending) {
      onSubmit()
    }
  }

  return (
    <main className={`${CONTAINER} py-8`}>
      <div className="mx-auto flex max-w-md flex-col gap-6 rounded-sm bg-surface-panel p-6">
        <h1 className="text-h1 font-bold text-fg">{title}</h1>

        {/* noValidate: the server's messages are the ones shown, next to each field. */}
        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
          {formError && (
            <p role="alert" className="text-sm text-danger">
              {formError}
            </p>
          )}
          {children}
          <Button type="submit" disabled={pending} className="mt-2 w-full">
            {pending ? 'Please wait…' : submitLabel}
          </Button>
        </form>

        <p className="text-sm text-fg-muted">{footer}</p>
      </div>
    </main>
  )
}
