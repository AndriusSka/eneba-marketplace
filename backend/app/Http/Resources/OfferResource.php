<?php

namespace App\Http\Resources;

use App\Models\Offer;
use App\Support\Discount;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * An offer row on the product page. Expects `stock` (withCount of available keys)
 * and the seller and product relations to be loaded.
 *
 * @mixin Offer
 */
final class OfferResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $stock = (int) $this->resource->getAttribute('stock');

        return [
            'id' => $this->id,
            'seller' => [
                'id' => $this->seller->id,
                'name' => $this->seller->name,
                'rating' => (float) $this->seller->rating,
            ],
            'price_cents' => $this->price_cents,
            'currency' => $this->currency,
            'discount_percent' => Discount::percent($this->price_cents, $this->product->msrp_cents),
            'stock' => $stock,
            'in_stock' => $stock > 0,
        ];
    }
}
