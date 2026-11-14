import type { RouteObject } from 'react-router'
import { Layout } from './components/Layout'
import { ProductPage } from './features/product/ProductPage'
import { StorePage } from './features/store/StorePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { SkeletonPage } from './pages/SkeletonPage'

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <SkeletonPage /> },
      { path: '/store', element: <StorePage /> },
      { path: '/product/:slug', element: <ProductPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
