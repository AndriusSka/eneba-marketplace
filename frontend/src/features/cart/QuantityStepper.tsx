type Props = {
  value: number
  max: number
  label: string
  onChange: (quantity: number) => void
  disabled?: boolean
}

/** DESIGN.md › Cart and checkout: − n +. */
export function QuantityStepper({ value, max, label, onChange, disabled = false }: Props) {
  return (
    <div role="group" aria-label={`Quantity of ${label}`} className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={disabled || value <= 1}
        onClick={() => onChange(value - 1)}
        className="flex size-8 items-center justify-center rounded-sm text-lg font-bold text-fg hover:enabled:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-50"
      >
        −
      </button>
      <output aria-live="polite" className="min-w-6 text-center text-sm font-bold">
        {value}
      </output>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
        className="flex size-8 items-center justify-center rounded-sm text-lg font-bold text-fg hover:enabled:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-50"
      >
        +
      </button>
    </div>
  )
}
