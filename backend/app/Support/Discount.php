<?php

namespace App\Support;

/** The one place the discount rule lives (ARCHITECTURE.md › Data model: 1 − price / msrp). */
final class Discount
{
    /**
     * Whole percent below MSRP, rounded down so a discount is never overstated.
     * Null when there is no price, or the price is not below MSRP by at least 1%.
     */
    public static function percent(?int $priceCents, int $msrpCents): ?int
    {
        if ($priceCents === null || $msrpCents <= 0 || $priceCents >= $msrpCents) {
            return null;
        }

        $percent = intdiv(100 * ($msrpCents - $priceCents), $msrpCents);

        return $percent >= 1 ? $percent : null;
    }
}
