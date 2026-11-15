import type { ReactNode } from 'react'
import { isBanner, type Banner, type HomeBlock } from '../api/home'
import { isArrayOf } from '../api/guards'
import { isProductSummary, type ProductSummary } from '../api/products'
import { HeroBanner } from './HeroBanner'
import { ProductCarousel } from './ProductCarousel'

type BlockRenderer = {
  /** Whether the block's data passes the type's guard. */
  accepts: (block: HomeBlock) => boolean
  /** The block's component, or null when the data fails the guard. */
  render: (block: HomeBlock) => ReactNode
}

/** Pairs a block type's data guard with its component. Data that fails the guard renders nothing. */
function defineBlock<T>(isData: (data: unknown) => data is T, render: (block: HomeBlock, data: T) => ReactNode): BlockRenderer {
  return {
    accepts: (block) => isData(block.data),
    render: (block) => (isData(block.data) ? render(block, block.data) : null),
  }
}

const isBanners = (data: unknown): data is Banner[] => isArrayOf(data, isBanner)
const isProducts = (data: unknown): data is ProductSummary[] => isArrayOf(data, isProductSummary)

const productRow = (block: HomeBlock, products: ProductSummary[]) => (
  <ProductCarousel title={block.title} linkUrl={block.link_url} products={products} />
)

/**
 * Block type (from GET /api/home) → component. Adding a block type takes one entry here and one
 * provider in the backend's AppServiceProvider. Titles, order and on/off state come from the API.
 */
const blockRegistry: Readonly<Record<string, BlockRenderer>> = {
  hero_banner: defineBlock(isBanners, (block, banners) => <HeroBanner title={block.title} banners={banners} />),
  best_sellers: defineBlock(isProducts, productRow),
  deals: defineBlock(isProducts, productRow),
}

/** The block's renderer, or undefined for an unknown type. */
export function rendererFor(block: HomeBlock): BlockRenderer | undefined {
  // Object.hasOwn, so a type like "toString" can't reach Object.prototype.
  return Object.hasOwn(blockRegistry, block.type) ? blockRegistry[block.type] : undefined
}

/** Whether HomeBlockView would draw anything: a known type with valid data. */
export function canRenderBlock(block: HomeBlock): boolean {
  return rendererFor(block)?.accepts(block) ?? false
}
