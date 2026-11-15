<?php

namespace App\Services\Checkout;

final readonly class CartQuote
{
    /** @param list<CartQuoteLine> $lines in the order the cart sent them */
    public function __construct(public array $lines) {}

    /** The sum of what can be bought now. Unbuyable lines count as 0. */
    public function totalCents(): int
    {
        return array_sum(array_map(fn (CartQuoteLine $line) => $line->lineTotalCents(), $this->lines));
    }

    /** True when checkout can go ahead: at least one line, and none of them is unbuyable. */
    public function checkoutReady(): bool
    {
        foreach ($this->lines as $line) {
            if ($line->blocksCheckout()) {
                return false;
            }
        }

        return $this->lines !== [];
    }
}
