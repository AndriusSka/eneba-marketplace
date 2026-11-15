import { useCallback, useEffect, useId, useRef, useState, type RefObject } from 'react'
import type { ProductSummary } from '../api/products'
import { Button } from '../components/Button'
import { buttonClasses } from '../components/buttonClasses'
import { ProductCard } from '../components/ProductCard'
import { SmartLink } from './SmartLink'

type Props = { title: string; linkUrl: string | null; products: ProductSummary[] }

/**
 * `best_sellers` and `deals`: a titled row of product cards that scrolls sideways. 5 cards fit from
 * lg, 4 from sm, and 2½ on phones so the cut-off card hints that the row scrolls.
 */
export function ProductCarousel({ title, linkUrl, products }: Props) {
  const headingId = useId()
  const listRef = useRef<HTMLUListElement>(null)
  const { atStart, atEnd, update } = useScrollEdges(listRef)

  const scrollPage = (direction: 1 | -1) => {
    const list = listRef.current
    list?.scrollBy({ left: direction * list.clientWidth, behavior: 'smooth' })
  }

  return (
    <section aria-labelledby={headingId}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id={headingId} className="text-h2 font-bold">
          {title}
        </h2>
        {!(atStart && atEnd) && (
          <div className="hidden gap-2 sm:flex">
            <Button variant="icon" aria-label={`Previous ${title}`} disabled={atStart} onClick={() => scrollPage(-1)}>
              <Chevron direction="left" />
            </Button>
            <Button variant="icon" aria-label={`Next ${title}`} disabled={atEnd} onClick={() => scrollPage(1)}>
              <Chevron direction="right" />
            </Button>
          </div>
        )}
      </div>

      <ul
        ref={listRef}
        onScroll={update}
        className="-mx-2 flex snap-x snap-mandatory overflow-x-auto scrollbar-none"
      >
        {products.map((product) => (
          <li key={product.id} className="flex min-w-0 shrink-0 basis-2/5 snap-start px-2 sm:basis-1/4 lg:basis-1/5">
            <ProductCard product={product} />
          </li>
        ))}
      </ul>

      {linkUrl !== null && (
        <div className="mt-6 flex justify-center">
          <SmartLink href={linkUrl} className={buttonClasses('secondary')}>
            View all
          </SmartLink>
        </div>
      )}
    </section>
  )
}

/** Whether the row is scrolled to its start or end, kept current on scroll and resize. */
function useScrollEdges(ref: RefObject<HTMLElement | null>) {
  const [edges, setEdges] = useState({ atStart: true, atEnd: true })

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    // 1px of slack for fractional scroll positions on zoomed or high-DPI screens.
    setEdges({ atStart: el.scrollLeft <= 1, atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 })
  }, [ref])

  useEffect(() => {
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [update])

  return { ...edges, update }
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 fill-none stroke-current stroke-2">
      <path d={direction === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
    </svg>
  )
}
