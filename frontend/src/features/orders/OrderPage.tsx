import { Link, useLocation, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { isObject } from '../../api/guards'
import { useOrder, type Order } from '../../api/orders'
import { PlatformPill, RegionLabel } from '../../components/Badge'
import { Button } from '../../components/Button'
import { CONTAINER } from '../../components/Layout'
import { Price } from '../../components/Price'
import { Skeleton } from '../../components/Skeleton'
import { formatCents } from '../../lib/money'
import { NotFoundPage } from '../../pages/NotFoundPage'
import { CheckoutSteps } from '../checkout/CheckoutSteps'
import { KeyCode } from './KeyCode'
import { formatOrderDate } from './orderDate'

/** `/orders/:id` (signed-in only): the order confirmation and, later, the order's page in history. */
export function OrderPage() {
  const { id = '' } = useParams()
  // Set by the checkout page on success, so the confirmation shows only right after paying.
  const state: unknown = useLocation().state
  const justPaid = isObject(state) && state.justPaid === true
  const { data: order, isPending, error, refetch } = useOrder(id)

  if (isPending) {
    return (
      <main className={`${CONTAINER} py-6`} aria-busy="true">
        <Skeleton className="mb-6 h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </main>
    )
  }

  if (error) {
    if (error instanceof ApiError && error.status === 404) return <NotFoundPage />
    return (
      <main className={`${CONTAINER} py-12`}>
        <div role="alert" className="rounded-sm bg-surface-panel p-6 text-center">
          <p className="text-base">The order couldn’t be loaded.</p>
          <Button className="mt-4" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      </main>
    )
  }

  return <OrderView order={order} justPaid={justPaid} />
}

function OrderView({ order, justPaid }: { order: Order; justPaid: boolean }) {
  return (
    <main className={`${CONTAINER} py-6`}>
      <title>{`Order #${order.id} | Market`}</title>
      {justPaid && <CheckoutSteps active="key" />}

      {justPaid && (
        <div role="status" className="mb-6 flex items-center gap-3 rounded-sm bg-surface-panel p-4">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-8 shrink-0 fill-teal">
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.2 14.2-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4-7 7Z" />
          </svg>
          <div>
            <p className="text-lg font-bold">Payment received</p>
            <p className="text-sm text-fg-muted">Your keys are below. They also stay in your order history.</p>
          </div>
        </div>
      )}

      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-fg-muted">
        <Link to="/orders" className="hover:text-fg">
          My orders
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-fg">Order #{order.id}</span>
      </nav>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-h1 font-bold">Order #{order.id}</h1>
        {order.paid_at && <p className="text-sm text-fg-muted">Paid {formatOrderDate(order.paid_at)}</p>}
      </div>

      <ul className="mt-6 flex flex-col gap-3">
        {order.items.map((item) => (
          <li key={item.id} className="flex flex-col gap-4 rounded-sm bg-surface-panel p-4 md:flex-row md:p-6">
            <img src={item.product.cover_url} alt="" className="aspect-3/4 w-20 shrink-0 self-start rounded-sm object-cover" />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link to={`/product/${item.product.slug}`} className="text-base font-bold hover:text-accent">
                    {item.product.title}
                  </Link>
                  <p className="text-xs text-fg-muted">Sold by {item.seller.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <PlatformPill platform={item.product.platform} />
                    <RegionLabel region={item.product.region} />
                  </div>
                </div>
                <p className="text-right text-sm">
                  {item.quantity} × {formatCents(item.unit_price_cents)}
                  <br />
                  <span className="text-base font-bold">{formatCents(item.line_total_cents)}</span>
                </p>
              </div>
              <div>
                <h2 className="mb-2 text-sm font-semibold">{item.keys && item.keys.length === 1 ? 'Your key' : 'Your keys'}</h2>
                <ul className="flex flex-col gap-2">
                  {(item.keys ?? []).map((key) => (
                    <li key={key.id}>
                      <KeyCode code={key.code} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-6 flex items-baseline justify-end gap-4">
        <span className="text-base font-bold">Total paid</span>
        <Price cents={order.total_cents} size="price-lg" />
      </p>
    </main>
  )
}
