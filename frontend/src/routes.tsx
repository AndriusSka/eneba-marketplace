import type { RouteObject } from 'react-router'
import { Layout } from './components/Layout'
import { LoginPage } from './features/auth/LoginPage'
import { RegisterPage } from './features/auth/RegisterPage'
import { HomePage } from './features/home/HomePage'
import { ProductPage } from './features/product/ProductPage'
import { StorePage } from './features/store/StorePage'
import { NotFoundPage } from './pages/NotFoundPage'

// Signed-in pages (checkout, orders) go under a `{ element: <RequireAuth />, children: [...] }`
// route in M6.
export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/store', element: <StorePage /> },
      { path: '/product/:slug', element: <ProductPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
