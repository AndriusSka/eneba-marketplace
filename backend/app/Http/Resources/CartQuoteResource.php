<?php

namespace App\Http\Resources;

use App\Services\Checkout\CartQuote;
use App\Services\Checkout\CartQuoteLine;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * POST /api/cart/quote: `{data: {lines, total_cents, currency, checkout_ready}}`.
 *
 * @property CartQuote $resource
 */
final class CartQuoteResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'lines' => array_map(fn (CartQuoteLine $line) => $this->line($line), $this->resource->lines),
            'total_cents' => $this->resource->totalCents(),
            'currency' => 'EUR',
            'checkout_ready' => $this->resource->checkoutReady(),
        ];
    }

    /** @return array<string, mixed> */
    private function line(CartQuoteLine $line): array
    {
        $offer = $line->offer;

        return [
            'offer_id' => $line->offerId,
            'requested_quantity' => $line->requestedQuantity,
            'quantity' => $line->quantity,
            'stock' => $line->stock,
            'unit_price_cents' => $offer?->price_cents,
            'line_total_cents' => $line->lineTotalCents(),
            'warning' => $line->warning,
            'product' => $offer === null ? null : ProductBrief::of($offer->product),
            'seller' => $offer === null ? null : ['id' => $offer->seller->id, 'name' => $offer->seller->name],
        ];
    }
}
