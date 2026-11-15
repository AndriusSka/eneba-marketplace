import type { RouteObject } from 'react-router'
import { Layout } from './components/Layout'
import { HomePage } from './features/home/HomePage'
import { ProductPage } from './features/product/ProductPage'
import { StorePage } from './features/store/StorePage'
import { NotFoundPage } from './pages/NotFoundPage'

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/store', element: <StorePage /> },
      { path: '/product/:slug', element: <ProductPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
