<?php

namespace App\Http\Resources;

use App\Models\Product;
use App\Support\Discount;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A product as it appears on a Store card. Expects the product to come from ProductCatalog,
 * which adds from_price_cents and from_offer_id and loads platform and region.
 *
 * @mixin Product
 */
class ProductSummaryResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $raw = $this->resource->getAttribute('from_price_cents');
        $fromPrice = $raw === null ? null : (int) $raw;
        $rawOffer = $this->resource->getAttribute('from_offer_id');

        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'title' => $this->title,
            'cover_url' => $this->cover_url,
            'platform' => ['slug' => $this->platform->slug, 'name' => $this->platform->name],
            'region' => ['slug' => $this->region->slug, 'name' => $this->region->name],
            'release_date' => $this->release_date?->toDateString(),
            'msrp_cents' => $this->msrp_cents,
            'currency' => $this->currency,
            'from_price_cents' => $fromPrice,
            'from_offer_id' => $rawOffer === null ? null : (int) $rawOffer,
            'discount_percent' => Discount::percent($fromPrice, $this->msrp_cents),
            'in_stock' => $fromPrice !== null,
        ];
    }
}
