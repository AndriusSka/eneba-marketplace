<?php

namespace App\Services\Homepage\Providers;

use App\Http\Resources\ProductSummaryResource;
use App\Models\OrderItem;
use App\Services\Catalog\ProductCatalog;
use App\Services\Homepage\BlockConfig;
use App\Services\Homepage\BlockProvider;

/**
 * `best_sellers`: products ranked by units sold on orders paid in the last `config.days` days.
 * Sold-out products are left out, so every card on the homepage can be bought.
 */
final class BestSellersProvider implements BlockProvider
{
    public function __construct(private readonly ProductCatalog $catalog) {}

    public function fetch(array $config): array
    {
        $days = BlockConfig::int($config, 'days', default: 30, min: 1, max: 365);

        $recentUnits = OrderItem::query()
            ->toBase()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('offers', 'offers.id', '=', 'order_items.offer_id')
            ->where('orders.paid_at', '>=', now()->subDays($days))
            ->groupBy('offers.product_id')
            ->select('offers.product_id')
            ->selectRaw('sum(order_items.quantity) as units');

        $products = $this->catalog->catalog()
            ->joinSub($recentUnits, 'recent', 'recent.product_id', '=', 'products.id')
            ->select('products.*')
            ->whereNotNull('products.from_price_cents')
            ->orderByDesc('recent.units')
            ->orderBy('products.id')
            ->limit(BlockConfig::int($config, 'limit', default: 12, min: 1, max: 24))
            ->with(['platform', 'region'])
            ->get();

        return ProductSummaryResource::collection($products)->resolve();
    }
}
