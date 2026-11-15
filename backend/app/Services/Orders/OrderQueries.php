<?php

namespace App\Services\Orders;

use App\Models\Order;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/** Reads of a user's own orders. Every query is scoped by user_id. */
final class OrderQueries
{
    /**
     * Order history, newest first. Items are loaded for the summary, keys are not.
     *
     * @return Collection<int, Order>
     */
    public function listFor(User $user): Collection
    {
        return $user->orders()
            ->with([
                'items' => fn (HasMany $items) => $items->orderBy('id'),
                'items.offer.product.platform',
                'items.offer.product.region',
                'items.offer.seller',
            ])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get();
    }

    /**
     * One order with its keys. Someone else's order and a missing one give the same 404, so ids
     * can't be probed.
     */
    public function findFor(User $user, int $orderId): Order
    {
        $order = $user->orders()->whereKey($orderId)->first();

        if ($order === null) {
            throw new NotFoundHttpException;
        }

        return $this->withDetails($order);
    }

    /** Everything OrderResource shows, keys included. */
    public function withDetails(Order $order): Order
    {
        return $order->load([
            'items' => fn (HasMany $items) => $items->orderBy('id'),
            'items.keys' => fn (HasMany $keys) => $keys->orderBy('id'),
            'items.offer.product.platform',
            'items.offer.product.region',
            'items.offer.seller',
        ]);
    }

    /** @return Builder<Order> */
    public function byIdempotencyKey(User $user, string $idempotencyKey): Builder
    {
        return Order::query()->where('user_id', $user->id)->where('idempotency_key', $idempotencyKey);
    }
}
