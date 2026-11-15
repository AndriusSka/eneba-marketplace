<?php

namespace App\Services\Checkout;

use App\Models\Key;
use App\Models\Offer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\User;
use App\Services\Orders\OrderQueries;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use LogicException;

/**
 * Turns a cart into a paid order with keys (ARCHITECTURE.md › Checkout transaction).
 *
 * The client sends offer ids and quantities only: every price is read from the database here.
 * A key can't be sold twice: keys are claimed with FOR UPDATE SKIP LOCKED and marked sold in the
 * same transaction, and the CHECK constraint `sold ⇔ order_item_id` rules out half-updated rows.
 */
final class CheckoutService
{
    public function __construct(private readonly OrderQueries $orders) {}

    /**
     * @param  list<array{offer_id: int, quantity: int}>  $items  distinct offer ids, quantity 1–10 (validated)
     * @param  string  $idempotencyKey  a UUID from the Idempotency-Key header
     *
     * @throws CheckoutException 402 declined, 409 out of stock or unavailable
     * @throws ValidationException 422 on card_number for a card that isn't a test card
     */
    public function checkout(User $user, array $items, string $cardNumber, string $idempotencyKey): CheckoutResult
    {
        // A retry of a request that already went through: return its order, do nothing else.
        $existing = $this->orders->byIdempotencyKey($user, $idempotencyKey)->first();
        if ($existing !== null) {
            return new CheckoutResult($this->orders->withDetails($existing), replayed: true);
        }

        // Pure, so it runs before any lock is taken. A decline saves nothing.
        match (TestCards::check($cardNumber)) {
            TestCards::RESULT_APPROVED => null,
            TestCards::RESULT_DECLINED => throw CheckoutException::cardDeclined(),
            default => throw ValidationException::withMessages([
                'card_number' => 'Use test card 4242 4242 4242 4242 (or 4000 0000 0000 0002 to see a decline).',
            ]),
        };

        try {
            $order = DB::transaction(fn () => $this->placeOrder($user, $items, $idempotencyKey));
        } catch (UniqueConstraintViolationException $e) {
            // A concurrent request with the same key committed first. Our transaction has been
            // rolled back (no keys taken), so return that request's order instead.
            $existing = $this->orders->byIdempotencyKey($user, $idempotencyKey)->first();
            if ($existing === null) {
                throw $e;
            }

            return new CheckoutResult($this->orders->withDetails($existing), replayed: true);
        }

        return new CheckoutResult($this->orders->withDetails($order), replayed: false);
    }

    /** @param list<array{offer_id: int, quantity: int}> $items */
    private function placeOrder(User $user, array $items, string $idempotencyKey): Order
    {
        // Lines in ascending offer id, so concurrent checkouts lock keys in the same order.
        usort($items, fn (array $a, array $b) => $a['offer_id'] <=> $b['offer_id']);

        // Re-price: the database is the only source of prices.
        $offers = Offer::query()
            ->with(['product', 'seller'])
            ->whereIn('id', array_column($items, 'offer_id'))
            ->get()
            ->keyBy('id');

        $total = 0;
        foreach ($items as $item) {
            $offer = $offers->get($item['offer_id']);
            if ($offer === null || ! $offer->is_active) {
                throw CheckoutException::offerUnavailable($offer, $item['offer_id']);
            }
            $total += $offer->price_cents * $item['quantity'];
        }

        // The order row goes in first: it is the idempotency claim. A concurrent request with the
        // same key waits here on the UNIQUE (user_id, idempotency_key) index, before it has locked
        // any key, and fails with a unique violation once this transaction commits. So a duplicate
        // never competes for keys, and can't see a false "out of stock".
        $order = Order::create([
            'user_id' => $user->id,
            'status' => Order::STATUS_PAID,
            'total_cents' => $total,
            'currency' => 'EUR',
            'idempotency_key' => $idempotencyKey,
            'paid_at' => now(),
        ]);

        foreach ($items as $item) {
            /** @var Offer $offer */
            $offer = $offers->get($item['offer_id']);
            $keyIds = $this->claimKeys($offer, $item['quantity']);

            $orderItem = OrderItem::create([
                'order_id' => $order->id,
                'offer_id' => $offer->id,
                'unit_price_cents' => $offer->price_cents, // copied at purchase time
                'quantity' => $item['quantity'],
            ]);

            $sold = Key::query()
                ->whereIn('id', $keyIds)
                ->where('status', Key::STATUS_AVAILABLE)
                ->update([
                    'status' => Key::STATUS_SOLD,
                    'order_item_id' => $orderItem->id,
                    'sold_at' => now(),
                    'updated_at' => now(),
                ]);

            // Can't happen while we hold the row locks; if it ever did, roll everything back.
            if ($sold !== count($keyIds)) {
                throw new LogicException("Expected to sell {$item['quantity']} keys of offer {$offer->id}, sold {$sold}.");
            }
        }

        return $order;
    }

    /**
     * Locks `$quantity` available keys of the offer until commit. SKIP LOCKED passes over keys
     * another checkout is holding, so buyers never wait for each other and never get a false
     * shortage from rows that turn out to be sold (ARCHITECTURE.md › Why SKIP LOCKED).
     *
     * @return list<int>
     *
     * @throws CheckoutException out_of_stock when fewer keys are free; the rollback releases all locks
     */
    private function claimKeys(Offer $offer, int $quantity): array
    {
        /** @var list<int> $ids */
        $ids = DB::table('keys')
            ->where('offer_id', $offer->id)
            ->where('status', Key::STATUS_AVAILABLE)
            ->orderBy('id')
            ->limit($quantity)
            ->lock('for update skip locked')
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        if (count($ids) < $quantity) {
            throw CheckoutException::outOfStock($offer, count($ids));
        }

        return $ids;
    }
}
