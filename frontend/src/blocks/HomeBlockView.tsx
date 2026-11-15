import type { HomeBlock } from '../api/home'
import { rendererFor } from './blockRegistry'

/** Renders one homepage block, or nothing when its type is unknown or its data is malformed. */
export function HomeBlockView({ block }: { block: HomeBlock }) {
  return rendererFor(block)?.render(block) ?? null
}
