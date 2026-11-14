import type { RouteObject } from 'react-router'
import { NotFoundPage } from './pages/NotFoundPage'
import { SkeletonPage } from './pages/SkeletonPage'

export const routes: RouteObject[] = [
  { path: '/', element: <SkeletonPage /> },
  { path: '*', element: <NotFoundPage /> },
]
