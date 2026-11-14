// DESIGN.md › Buttons. Shared by <Button> and by links styled as buttons.

const VARIANTS = {
  primary: 'bg-accent text-on-accent font-bold hover:enabled:bg-accent-hover',
  secondary: 'border border-line-strong bg-transparent text-fg font-bold hover:enabled:bg-surface-raised',
  icon: 'bg-transparent text-fg',
} as const

const SIZES = {
  md: 'h-10 px-4',
  sm: 'h-8 px-3',
} as const

export type ButtonVariant = keyof typeof VARIANTS
export type ButtonSize = keyof typeof SIZES

export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra = ''): string {
  return [
    'inline-flex items-center justify-center gap-2 rounded-sm text-sm whitespace-nowrap',
    'disabled:cursor-not-allowed disabled:opacity-50',
    VARIANTS[variant],
    variant === 'icon' ? '' : SIZES[size],
    extra,
  ].join(' ')
}
