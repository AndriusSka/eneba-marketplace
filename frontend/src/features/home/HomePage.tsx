import { Link } from 'react-router'
import { useHome } from '../../api/home'
import { Button } from '../../components/Button'
import { buttonClasses } from '../../components/buttonClasses'
import { CONTAINER } from '../../components/Layout'
import { ProductCardSkeleton } from '../../components/ProductCard'
import { Skeleton } from '../../components/Skeleton'
import { BlockErrorBoundary } from '../../blocks/BlockErrorBoundary'
import { canRenderBlock } from '../../blocks/blockRegistry'
import { HomeBlockView } from '../../blocks/HomeBlockView'

const SKELETON_CARDS = 5

/**
 * The homepage is whatever GET /api/home returns, in that order. Block titles, order and on/off
 * state live in the `homepage_blocks` table, never here.
 *
 * Each block sits in its own full-width band, and every second band is `surface`, like the
 * alternating section bands on Eneba's homepage (docs/design/02). The bands follow position only,
 * not block type, so reordering blocks in the database still alternates correctly.
 */
export function HomePage() {
  const { data, isPending, isError, refetch } = useHome()
  // Only blocks that draw something get a band, so a malformed block can't leave an empty stripe.
  const blocks = data?.filter(canRenderBlock) ?? []

  return (
    <main>
      <title>Market</title>
      <h1 className="sr-only">Market</h1>

      {isPending ? (
        <div className={`${CONTAINER} py-6`}>
          <HomeSkeleton />
        </div>
      ) : isError ? (
        <div className={`${CONTAINER} py-6`}>
          <div role="alert" className="rounded-sm bg-surface p-6 text-center">
            <p className="text-base">The homepage couldn’t be loaded.</p>
            <Button className="mt-4" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        </div>
      ) : blocks.length === 0 ? (
        <div className={`${CONTAINER} py-6`}>
          <div className="rounded-sm bg-surface p-6 text-center">
            <p className="text-base">There’s nothing featured right now.</p>
            <Link to="/store" className={buttonClasses('primary', 'md', 'mt-4')}>
              Browse the store
            </Link>
          </div>
        </div>
      ) : (
        blocks.map((block, index) => (
          // 24px above and below each block: 48px between sections (DESIGN.md › Spacing).
          <div key={block.id} className={index % 2 === 1 ? 'bg-surface' : ''}>
            <div className={`${CONTAINER} py-6`}>
              <BlockErrorBoundary blockType={block.type}>
                <HomeBlockView block={block} />
              </BlockErrorBoundary>
            </div>
          </div>
        ))
      )}
    </main>
  )
}

/** A neutral placeholder: the real layout depends on which blocks the API returns. */
function HomeSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-12">
      <Skeleton className="aspect-2/1 w-full lg:aspect-3/1" />
      <div>
        <Skeleton className="mb-4 h-9 w-48" />
        <div className="-mx-2 flex overflow-hidden">
          {Array.from({ length: SKELETON_CARDS }, (_, i) => (
            <div key={i} className="shrink-0 basis-2/5 px-2 sm:basis-1/4 lg:basis-1/5">
              <ProductCardSkeleton />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
