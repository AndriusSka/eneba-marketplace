// DESIGN.md › Cart and checkout: steps Cart → Payment → Key, the active one in `teal`.

const STEPS = [
  { id: 'cart', label: 'Cart' },
  { id: 'payment', label: 'Payment' },
  { id: 'key', label: 'Key' },
] as const

export type CheckoutStep = (typeof STEPS)[number]['id']

export function CheckoutSteps({ active }: { active: CheckoutStep }) {
  return (
    <ol aria-label="Checkout steps" className="mb-6 flex flex-wrap items-center gap-3 text-sm font-semibold">
      {STEPS.map((step, index) => {
        const current = step.id === active
        return (
          <li key={step.id} className="flex items-center gap-3" aria-current={current ? 'step' : undefined}>
            {index > 0 && <span aria-hidden="true" className="h-px w-6 bg-line-strong sm:w-12" />}
            <span className={`flex items-center gap-2 ${current ? 'text-teal' : 'text-fg-muted'}`}>
              <span
                aria-hidden="true"
                className={`flex size-6 items-center justify-center rounded-full text-xs ${current ? 'bg-teal text-on-accent' : 'bg-surface-raised text-fg-muted'}`}
              >
                {index + 1}
              </span>
              {step.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
