import { useState, type FormEvent, type ReactNode } from 'react'
import type { FacetOption, ProductList } from '../../api/products'
import { centsToInput, formatCents, inputToCents } from '../../lib/money'
import type { StoreParams } from './storeParams'

const VISIBLE_OPTIONS = 6

type Props = {
  params: StoreParams
  facets: ProductList['facets'] | undefined
  onChange: (patch: Partial<StoreParams>) => void
}

/** DESIGN.md › Filter sidebar. Every change applies immediately (pushed to the URL). */
export function FilterSidebar({ params, facets, onChange }: Props) {
  return (
    <div className="divide-y divide-line">
      <Section title="Price (EUR)">
        <PriceRange
          minPrice={params.minPrice}
          maxPrice={params.maxPrice}
          bounds={facets?.price}
          onChange={onChange}
        />
      </Section>
      <Section title="Platform">
        <CheckboxList
          name="platform"
          options={facets?.platforms ?? []}
          selected={params.platforms}
          onChange={(platforms) => onChange({ platforms })}
        />
      </Section>
      <Section title="Region">
        <CheckboxList
          name="region"
          options={facets?.regions ?? []}
          selected={params.regions}
          onChange={(regions) => onChange({ regions })}
        />
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details open className="group p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold text-fg [&::-webkit-details-marker]:hidden">
        {title}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-4 fill-none stroke-current stroke-2 transition-transform group-open:rotate-180"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="pt-3">{children}</div>
    </details>
  )
}

type PriceRangeProps = {
  minPrice: number | null
  maxPrice: number | null
  bounds: ProductList['facets']['price'] | undefined
  onChange: (patch: Partial<StoreParams>) => void
}

/** Commits on Enter or blur, not on every keystroke, so each Back step is a real filter state. */
function PriceRange({ minPrice, maxPrice, bounds, onChange }: PriceRangeProps) {
  const [min, setMin] = useState(toInput(minPrice))
  const [max, setMax] = useState(toInput(maxPrice))

  // When the URL changes underneath (Back, Clear filters), show the restored values.
  // Adjusting state during render is React's recommended alternative to a syncing effect.
  const [shown, setShown] = useState({ minPrice, maxPrice })
  if (shown.minPrice !== minPrice || shown.maxPrice !== maxPrice) {
    setShown({ minPrice, maxPrice })
    setMin(toInput(minPrice))
    setMax(toInput(maxPrice))
  }

  function commit() {
    let nextMin = inputToCents(min)
    let nextMax = inputToCents(max)
    if (nextMin !== null && nextMax !== null && nextMax < nextMin) {
      ;[nextMin, nextMax] = [nextMax, nextMin]
    }
    onChange({ minPrice: nextMin, maxPrice: nextMax })
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    commit()
  }

  const inputClass =
    'h-10 w-full min-w-0 rounded-sm bg-field-filter px-3 text-sm text-fg placeholder:text-fg-muted'

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <label className="sr-only" htmlFor="price-min">
        Minimum price in euros
      </label>
      <input
        id="price-min"
        inputMode="decimal"
        autoComplete="off"
        className={inputClass}
        placeholder={bounds?.min_cents == null ? 'Min' : formatCents(bounds.min_cents)}
        value={min}
        onChange={(event) => setMin(event.target.value)}
        onBlur={commit}
      />
      <span aria-hidden="true" className="text-fg">
        –
      </span>
      <label className="sr-only" htmlFor="price-max">
        Maximum price in euros
      </label>
      <input
        id="price-max"
        inputMode="decimal"
        autoComplete="off"
        className={inputClass}
        placeholder={bounds?.max_cents == null ? 'Max' : formatCents(bounds.max_cents)}
        value={max}
        onChange={(event) => setMax(event.target.value)}
        onBlur={commit}
      />
      {/* Enter submits; a hidden button keeps implicit submission working with two inputs. */}
      <button type="submit" className="sr-only">
        Apply price
      </button>
    </form>
  )
}

function toInput(cents: number | null): string {
  return cents === null ? '' : centsToInput(cents)
}

type CheckboxListProps = {
  name: string
  options: FacetOption[]
  selected: string[]
  onChange: (selected: string[]) => void
}

function CheckboxList({ name, options, selected, onChange }: CheckboxListProps) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? options : options.slice(0, VISIBLE_OPTIONS)
  const hidden = options.length - visible.length

  function toggle(slug: string) {
    onChange(selected.includes(slug) ? selected.filter((s) => s !== slug) : [...selected, slug])
  }

  return (
    <ul className="flex flex-col gap-2">
      {visible.map((option) => {
        const checked = selected.includes(option.slug)
        return (
          <li key={option.slug} className={option.count === 0 && !checked ? 'opacity-50' : ''}>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-fg">
              <input
                type="checkbox"
                name={name}
                value={option.slug}
                checked={checked}
                onChange={() => toggle(option.slug)}
                className="size-4 shrink-0 cursor-pointer appearance-none rounded-sm border border-line-strong checked:border-accent checked:bg-accent"
              />
              <span className="flex-1">{option.name}</span>
              <span className="text-xs text-fg">{option.count}</span>
            </label>
          </li>
        )
      })}
      {hidden > 0 && (
        <li>
          <button type="button" className="text-sm font-semibold text-accent" onClick={() => setExpanded(true)}>
            Show {hidden} more
          </button>
        </li>
      )}
    </ul>
  )
}
