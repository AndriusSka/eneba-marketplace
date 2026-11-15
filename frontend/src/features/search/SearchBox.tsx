import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { MIN_SUGGEST_LENGTH, useSuggestions } from '../../api/search'
import { useDebouncedValue } from '../../lib/useDebouncedValue'
import { DEFAULT_STORE_PARAMS, MAX_QUERY_LENGTH, parseStoreParams, toSearchParams } from '../store/storeParams'
import { SuggestionRow } from './SuggestionRow'

export const SUGGEST_DEBOUNCE_MS = 250

/**
 * The header search on every page (SPEC › Search; DESIGN.md › Header with search).
 *
 * Typing shows up to 6 product suggestions (debounced). ↑/↓ pick a row, Enter opens it; Enter with
 * no row picked opens the full results at /store?q=… with no other filters. Esc closes the list.
 * On /store the box shows the current `q`, so it is the Store's only name input.
 */
export function SearchBox() {
  const location = useLocation()
  const navigate = useNavigate()
  const id = useId()
  const listId = `${id}-list`
  const inputRef = useRef<HTMLInputElement>(null)

  const urlQuery = location.pathname === '/store' ? parseStoreParams(new URLSearchParams(location.search)).q : ''
  const [text, setText] = useState(urlQuery)
  const [focused, setFocused] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)

  // Every navigation (a search, a picked product, Back, the Store's "Clear filters") resets the
  // box to what the URL says and closes the list.
  const [seenLocation, setSeenLocation] = useState(location.key)
  if (seenLocation !== location.key) {
    setSeenLocation(location.key)
    setText(urlQuery)
    setOpen(false)
    setActive(-1)
  }

  const typed = text.trim()
  const debounced = useDebouncedValue(typed, SUGGEST_DEBOUNCE_MS)
  const { data, isPlaceholderData } = useSuggestions(debounced)

  const searching = typed.length >= MIN_SUGGEST_LENGTH && debounced.length >= MIN_SUGGEST_LENGTH
  const rows = searching ? (data ?? []) : []
  const noResults = searching && data !== undefined && !isPlaceholderData && data.length === 0
  const expanded = open && (rows.length > 0 || noResults)
  const activeRow = expanded && active < rows.length ? active : -1

  function openProduct(slug: string) {
    inputRef.current?.blur()
    void navigate(`/product/${slug}`)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (typed === '') return
    inputRef.current?.blur()
    const params = toSearchParams({ ...DEFAULT_STORE_PARAMS, q: typed.slice(0, MAX_QUERY_LENGTH) })
    void navigate({ pathname: '/store', search: `?${params.toString()}` })
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setOpen(true)
        if (rows.length > 0) setActive((activeRow + 1) % rows.length)
        break
      case 'ArrowUp':
        event.preventDefault()
        setOpen(true)
        if (rows.length > 0) setActive(activeRow <= 0 ? rows.length - 1 : activeRow - 1)
        break
      case 'Enter':
        if (activeRow >= 0) {
          event.preventDefault()
          openProduct(rows[activeRow].slug)
        }
        break
      case 'Escape':
        if (expanded) {
          event.preventDefault()
          setOpen(false)
          setActive(-1)
        }
        break
    }
  }

  return (
    <form role="search" onSubmit={submit} className="relative w-full">
      <label htmlFor={`${id}-input`} className="sr-only">
        Search games and gift cards
      </label>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 fill-none stroke-fg-muted stroke-2"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        ref={inputRef}
        id={`${id}-input`}
        type="text"
        enterKeyHint="search"
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={activeRow >= 0 ? `${listId}-${activeRow}` : undefined}
        value={text}
        maxLength={MAX_QUERY_LENGTH}
        placeholder="Search games and gift cards"
        onChange={(event) => {
          setText(event.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => {
          setFocused(true)
          setOpen(true)
        }}
        onBlur={() => {
          setFocused(false)
          setOpen(false)
          setActive(-1)
        }}
        onKeyDown={onKeyDown}
        className="h-12 w-full rounded-sm border border-line-strong bg-transparent pr-10 pl-10 text-sm text-fg placeholder:text-fg-muted focus:bg-field-focus"
      />
      {focused && text !== '' && (
        <button
          type="button"
          aria-label="Clear search"
          // Keep focus in the input: a mousedown would blur it before the click lands.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setText('')
            setActive(-1)
          }}
          className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-sm text-fg-muted hover:text-fg"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      )}

      <ul
        id={listId}
        role="listbox"
        aria-label="Suggestions"
        hidden={!expanded}
        className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded bg-page shadow-pop"
      >
        {noResults ? (
          <li role="option" aria-selected={false} aria-disabled="true" className="px-3 py-3 text-sm text-fg-muted">
            No results for “{debounced}”
          </li>
        ) : (
          rows.map((product, index) => (
            <li
              key={product.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === activeRow}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => openProduct(product.slug)}
              className={`cursor-pointer border-b border-line last:border-b-0 ${index === activeRow ? 'bg-surface-raised' : ''}`}
            >
              <SuggestionRow product={product} />
            </li>
          ))
        )}
      </ul>
    </form>
  )
}
