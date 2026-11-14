<?php

namespace App\Http\Resources;

use App\Models\Product;
use Illuminate\Http\Request;

/**
 * The product page: the card fields plus the description and every active offer
 * (already ordered by ProductCatalog::find()).
 *
 * @mixin Product
 */
final class ProductDetailResource extends ProductSummaryResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            ...parent::toArray($request),
            'description' => $this->description,
            'offers' => OfferResource::collection($this->offers),
        ];
    }
}
