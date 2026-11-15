import { Link } from 'react-router'
import { useOrders } from '../../api/orders'
import { Button } from '../../components/Button'
import { buttonClasses } from '../../components/buttonClasses'
import { CONTAINER } from '../../components/Layout'
import { Skeleton } from '../../components/Skeleton'
import { formatCents } from '../../lib/money'
import { formatOrderDate } from './orderDate'

/** `/orders` (signed-in only): order history, newest first (the API's order). */
export function OrdersPage() {
  const { data: orders, isPending, isError, refetch } = useOrders()

  return (
    <main className={`${CONTAINER} py-6`}>
      <title>My orders | Market</title>
      <h1 className="mb-6 text-h1 font-bold">My orders</h1>

      {isPending ? (
        <div aria-busy="true" className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : isError ? (
        <div role="alert" className="rounded-sm bg-surface-panel p-6 text-center">
          <p className="text-base">Your orders couldn’t be loaded.</p>
          <Button className="mt-4" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-sm bg-surface-panel p-8 text-center">
          <p className="text-lg font-bold">No orders yet</p>
          <p className="mt-2 text-base text-fg-muted">Keys you buy will show up here.</p>
          <Link to="/store" className={buttonClasses('primary', 'md', 'mt-6')}>
            Browse the store
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                to={`/orders/${order.id}`}
                className="flex flex-col gap-2 rounded-sm bg-surface-panel p-4 hover:outline hover:outline-line-strong sm:flex-row sm:items-center sm:justify-between md:px-6"
              >
                <div className="min-w-0">
                  <p className="text-base font-bold">Order #{order.id}</p>
                  <p className="truncate text-sm">{order.items.map((item) => item.product.title).join(', ')}</p>
                  <p className="text-xs text-fg-muted">
                    {order.paid_at ? formatOrderDate(order.paid_at) : ''} · {order.item_count}{' '}
                    {order.item_count === 1 ? 'key' : 'keys'}
                  </p>
                </div>
                <p className="text-lg font-bold">{formatCents(order.total_cents)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
