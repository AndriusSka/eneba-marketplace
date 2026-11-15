import { useId } from 'react'
import type { Banner } from '../api/home'
import { SmartLink } from './SmartLink'

/**
 * `hero_banner`. Like Eneba's homepage (docs/design/01-home.jpg): from lg, the first banner is large
 * and the next ones are tiles beside it; below lg, a swipeable row. No autoplay.
 */
export function HeroBanner({ title, banners }: { title: string; banners: Banner[] }) {
  const headingId = useId()

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="sr-only">
        {title}
      </h2>
      <ul className="-mx-2 flex snap-x snap-mandatory overflow-x-auto scrollbar-none lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-4 lg:overflow-visible">
        {banners.map((banner, index) => {
          const layout = tileLayout(index, banners.length)
          return (
            <li key={banner.id} className={`flex shrink-0 basis-11/12 snap-start px-2 sm:basis-2/3 lg:px-0 ${layout.cell}`}>
              <BannerTile banner={banner} large={index === 0} sizing={layout.tile} />
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * Below lg every tile is 2:1. From lg, in a 3-column grid:
 * - 1 banner: one full-width 3:1 tile.
 * - 2 banners: a 2:1 tile over two columns, and a tall tile beside it that takes the same height.
 * - 3 or more: the first spans two columns and two rows, and takes the height of the 2:1 tiles
 *   stacked beside it. Any further banners flow on as 2:1 tiles.
 */
function tileLayout(index: number, count: number): { cell: string; tile: string } {
  if (count === 1) return { cell: 'lg:col-span-3', tile: 'aspect-2/1 lg:aspect-3/1' }
  if (count === 2) {
    return index === 0 ? { cell: 'lg:col-span-2', tile: 'aspect-2/1' } : { cell: '', tile: 'aspect-2/1 lg:aspect-auto lg:h-full' }
  }
  if (index === 0) return { cell: 'lg:col-span-2 lg:row-span-2', tile: 'aspect-2/1 lg:aspect-auto lg:h-full' }
  return { cell: '', tile: 'aspect-2/1' }
}

function BannerTile({ banner, large, sizing }: { banner: Banner; large: boolean; sizing: string }) {
  return (
    <SmartLink
      href={banner.link_url}
      className={`relative block w-full overflow-hidden rounded-sm bg-surface outline-line-strong hover:outline ${sizing}`}
    >
      {/* The title and subtitle are real text below, so the image itself is decorative. */}
      <img src={banner.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      {/* A scrim that fades out upwards, so the art reads as one picture (as on Eneba's banners)
          instead of being cut by a solid caption band. The art leaves this bottom strip calm. */}
      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-scrim from-50% to-transparent p-4 pt-12">
        <p className={`${large ? 'text-lg lg:text-h2' : 'text-lg'} font-bold text-fg`}>{banner.title}</p>
        {banner.subtitle !== null && <p className="mt-1 text-sm text-fg">{banner.subtitle}</p>}
      </div>
    </SmartLink>
  )
}
