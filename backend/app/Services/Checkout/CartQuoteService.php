<?php

namespace App\Services\Checkout;

use App\Models\Key;
use App\Models\Offer;
use Illuminate\Database\Eloquent\Builder;

/**
 * Prices a browser cart (SPEC.md › Checkout: the cart page never shows prices cached in the
 * browser). Read-only: nothing is reserved, so stock can still run out before checkout, which
 * then answers 409.
 */
final class CartQuoteService
{
    /** @param list<array{offer_id: int, quantity: int}> $items distinct offer ids (validated) */
    public function quote(array $items): CartQuote
    {
        $offers = Offer::query()
            ->with(['product.platform', 'product.region', 'seller'])
            ->withCount(['keys as stock' => fn (Builder $keys) => $keys->where('status', Key::STATUS_AVAILABLE)])
            ->whereIn('id', array_column($items, 'offer_id'))
            ->get()
            ->keyBy('id');

        $lines = array_map(function (array $item) use ($offers) {
            $offer = $offers->get($item['offer_id']);
            $requested = $item['quantity'];
            $stock = $offer === null ? 0 : (int) $offer->getAttribute('stock');

            [$quantity, $warning] = match (true) {
                $offer === null => [0, CartQuoteLine::UNAVAILABLE],
                ! $offer->is_active => [0, CartQuoteLine::INACTIVE],
                $stock === 0 => [0, CartQuoteLine::OUT_OF_STOCK],
                $requested > $stock => [$stock, CartQuoteLine::QUANTITY_REDUCED],
                default => [$requested, null],
            };

            return new CartQuoteLine($item['offer_id'], $requested, $quantity, $stock, $offer, $warning);
        }, $items);

        return new CartQuote($lines);
    }
}
