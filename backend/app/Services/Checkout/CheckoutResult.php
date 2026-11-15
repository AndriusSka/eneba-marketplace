<?php

namespace App\Services\Checkout;

use App\Models\Order;

final readonly class CheckoutResult
{
    /** @param  bool  $replayed  true when the Idempotency-Key already had an order (HTTP 200, not 201) */
    public function __construct(
        public Order $order,
        public bool $replayed,
    ) {}
}
