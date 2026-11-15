<?php

namespace App\Services\Homepage\Providers;

use App\Http\Resources\ProductSummaryResource;
use App\Services\Catalog\ProductCatalog;
use App\Services\Homepage\BlockConfig;
use App\Services\Homepage\BlockProvider;

/**
 * `deals`: products whose cheapest active in-stock offer (the catalog's from-price) is at least
 * `config.min_discount` percent below MSRP, biggest discount first.
 */
final class DealsProvider implements BlockProvider
{
    public function __construct(private readonly ProductCatalog $catalog) {}

    public function fetch(array $config): array
    {
        $minDiscount = BlockConfig::int($config, 'min_discount', default: 1, min: 1, max: 99);

        $products = $this->catalog->catalog()
            ->whereNotNull('from_price_cents')
            ->whereColumn('from_price_cents', '<', 'msrp_cents')
            // Integer division floors, the same rounding as App\Support\Discount, so the threshold
            // agrees with the discount_percent shown on the card.
            ->whereRaw('(100 * (msrp_cents - from_price_cents)) / msrp_cents >= ?', [$minDiscount])
            ->orderByRaw('from_price_cents::numeric / msrp_cents asc')
            ->orderBy('id')
            ->limit(BlockConfig::int($config, 'limit', default: 12, min: 1, max: 24))
            ->with(['platform', 'region'])
            ->get();

        return ProductSummaryResource::collection($products)->resolve();
    }
}
