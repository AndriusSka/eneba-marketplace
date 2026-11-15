import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { ME_QUERY_KEY } from '../../api/auth'
import { CART_QUOTE_KEY, toItems, type CartQuote } from '../../api/cart'
import { ApiError } from '../../api/client'
import { useCheckout } from '../../api/orders'
import { Button } from '../../components/Button'
import { CONTAINER } from '../../components/Layout'
import { Price } from '../../components/Price'
import { Skeleton } from '../../components/Skeleton'
import { TextField } from '../../components/TextField'
import { formatCents } from '../../lib/money'
import { cartStore, useCart } from '../cart/cartStore'
import { useSyncedQuote } from '../cart/useSyncedQuote'
import { CheckoutSteps } from './CheckoutSteps'
import { useIdempotencyKey } from './useIdempotencyKey'

/** SPEC.md › Payment can be simulated: Stripe-style test numbers. */
const TEST_CARDS = [
  { number: '4242 4242 4242 4242', result: 'payment succeeds' },
  { number: '4000 0000 0000 0002', result: 'card is declined' },
] as const

type Errors = { card?: string; form?: string }

/** `/checkout` (signed-in only, see routes.tsx): order summary and the simulated card form. */
export function CheckoutPage() {
  const cart = useCart()
  const { quote } = useSyncedQuote(cart)
  const [placedOrderId, setPlacedOrderId] = useState<number | null>(null)

  // Checked first: paying clears the cart, which must not bounce us to the empty cart page.
  if (placedOrderId !== null) {
    return <Navigate to={`/orders/${placedOrderId}`} replace state={{ justPaid: true }} />
  }
  if (cart.length === 0) {
    return <Navigate to="/cart" replace />
  }
  // Something in the cart can't be bought: the cart page explains what and lets the shopper fix it.
  if (quote.data && !quote.isPlaceholderData && !quote.data.checkout_ready) {
    return <Navigate to="/cart" replace />
  }

  return (
    <main className={`${CONTAINER} py-6`}>
      <title>Checkout | KeyMarket</title>
      <CheckoutSteps active="payment" />

      {quote.isError ? (
        <div role="alert" className="rounded-sm bg-surface-panel p-6 text-center">
          <p className="text-base">We couldn’t load your order summary.</p>
          <Button className="mt-4" onClick={() => void quote.refetch()}>
            Try again
          </Button>
        </div>
      ) : !quote.data ? (
        <div aria-busy="true" className="flex flex-col gap-6 lg:flex-row">
          <Skeleton className="h-64 flex-1" />
          <Skeleton className="h-64 lg:w-96" />
        </div>
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <OrderSummary quote={quote.data} />
          <PaymentForm totalCents={quote.data.total_cents} disabled={quote.isPlaceholderData} onPaid={setPlacedOrderId} />
        </div>
      )}
    </main>
  )
}

function OrderSummary({ quote }: { quote: CartQuote }) {
  return (
    <section aria-labelledby="summary-heading" className="flex-1 rounded-sm bg-surface-panel p-4 md:p-6">
      <h1 id="summary-heading" className="mb-4 text-lg font-bold">
        Order summary
      </h1>
      <ul className="flex flex-col gap-3">
        {quote.lines.map((line) => (
          <li key={line.offer_id} className="flex items-center gap-3 rounded-sm bg-surface-inset p-3">
            {line.product && <img src={line.product.cover_url} alt="" className="aspect-3/4 w-12 shrink-0 rounded-sm object-cover" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{line.product?.title}</p>
              <p className="text-xs text-fg-muted">
                {line.seller?.name} · {line.quantity} × {formatCents(line.unit_price_cents ?? 0)}
              </p>
            </div>
            <p className="text-base font-bold">{formatCents(line.line_total_cents)}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
        <span className="text-base font-bold">Total</span>
        <Price cents={quote.total_cents} size="price-lg" />
      </p>
    </section>
  )
}

function PaymentForm({
  totalCents,
  disabled,
  onPaid,
}: {
  totalCents: number
  disabled: boolean
  onPaid: (orderId: number) => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const checkout = useCheckout()
  const idempotencyKey = useIdempotencyKey()
  // A second click lands before React re-renders the disabled button: this ref stops it.
  const inFlight = useRef(false)
  const [card, setCard] = useState('')
  const [errors, setErrors] = useState<Errors>({})

  async function pay(event: FormEvent) {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    setErrors({})

    try {
      // Read the cart now, not from the render: the quote may have just clamped it.
      const order = await checkout.mutateAsync({
        items: toItems(cartStore.get()),
        card_number: card,
        idempotencyKey: idempotencyKey.get(),
      })
      onPaid(order.id)
      cartStore.clear()
    } catch (error) {
      if (!(error instanceof ApiError) || error.status >= 500) {
        // The payment may have gone through: keep the key, so trying again replays it.
        setErrors({ form: 'We couldn’t confirm the payment. Please try again: you won’t be charged twice.' })
        return
      }

      // A definite answer: this attempt is over and nothing was saved.
      idempotencyKey.reset()

      if (error.status === 401) {
        // The session expired. RequireAuth sends the user to sign in and back here; the cart is kept.
        queryClient.setQueryData(ME_QUERY_KEY, null)
      } else if (error.status === 402) {
        setErrors({ card: error.message })
      } else if (error.status === 409) {
        // Stock or availability changed: show the refreshed cart with the reason.
        void queryClient.invalidateQueries({ queryKey: [CART_QUOTE_KEY] })
        void navigate('/cart', { state: { notice: `${error.message} Your cart has been updated.` } })
      } else if (error.status === 422) {
        const cardError = error.errors.card_number?.[0]
        const others = Object.entries(error.errors).filter(([field]) => field !== 'card_number')
        setErrors({
          card: cardError,
          form: others.length > 0 ? 'Your cart could not be checked out. Please review it and try again.' : undefined,
        })
      } else {
        setErrors({ form: error.message })
      }
    } finally {
      inFlight.current = false
    }
  }

  return (
    <form
      onSubmit={(event) => void pay(event)}
      noValidate
      aria-labelledby="payment-heading"
      className="rounded-sm bg-surface-panel p-4 md:p-6 lg:w-96"
    >
      <h2 id="payment-heading" className="mb-4 text-lg font-bold">
        Payment
      </h2>

      <TextField
        label="Card number"
        name="card_number"
        inputMode="numeric"
        autoComplete="cc-number"
        placeholder="4242 4242 4242 4242"
        maxLength={32}
        required
        value={card}
        error={errors.card}
        onChange={(event) => setCard(event.target.value)}
      />

      <div className="mt-3 text-xs text-fg-muted">
        <p>Payments are simulated. Use a test card:</p>
        <ul className="mt-1 flex flex-col gap-1">
          {TEST_CARDS.map((test) => (
            <li key={test.number}>
              <button
                type="button"
                className="font-mono text-fg underline hover:text-accent"
                onClick={() => setCard(test.number)}
              >
                {test.number}
              </button>{' '}
              ({test.result})
            </li>
          ))}
        </ul>
      </div>

      {errors.form && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {errors.form}
        </p>
      )}

      <Button type="submit" className="mt-6 w-full" loading={checkout.isPending} disabled={disabled || card.trim() === ''}>
        Pay {formatCents(totalCents)}
      </Button>
    </form>
  )
}
