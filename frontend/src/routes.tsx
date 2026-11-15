import type { RouteObject } from 'react-router'
import { Layout } from './components/Layout'
import { LoginPage } from './features/auth/LoginPage'
import { RegisterPage } from './features/auth/RegisterPage'
import { RequireAuth } from './features/auth/RequireAuth'
import { CartPage } from './features/cart/CartPage'
import { CheckoutPage } from './features/checkout/CheckoutPage'
import { HomePage } from './features/home/HomePage'
import { OrderPage } from './features/orders/OrderPage'
import { OrdersPage } from './features/orders/OrdersPage'
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
      // Guests have carts too; sign-in is asked for at checkout (SPEC.md › Interpretations).
      { path: '/cart', element: <CartPage /> },
      {
        // Signed-in only: a guest is sent to /login?next=… and comes back here.
        element: <RequireAuth />,
        children: [
          { path: '/checkout', element: <CheckoutPage /> },
          { path: '/orders', element: <OrdersPage /> },
          { path: '/orders/:id', element: <OrderPage /> },
        ],
      },
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
