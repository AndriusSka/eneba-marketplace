<?php

namespace App\Services\Catalog;

use App\Models\Key;
use App\Models\Offer;
use App\Models\OrderItem;
use App\Models\Platform;
use App\Models\Product;
use App\Models\Region;
use App\Services\ProductSearch;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Store listing and product details.
 *
 * Every read goes through catalog(): products plus two derived columns (ARCHITECTURE.md › Data model):
 * - from_price_cents: the lowest price among active offers with at least one available key, or NULL
 *   when nothing is in stock.
 * - sales: all-time SUM(order_items.quantity) over the product's offers.
 */
final class ProductCatalog
{
    private const EXCEPT_PLATFORM = 'platform';

    private const EXCEPT_REGION = 'region';

    private const EXCEPT_PRICE = 'price';

    public function __construct(private readonly ProductSearch $search) {}

    public const SUGGEST_LIMIT = 6;

    public function list(ProductFilters $filters): ProductListResult
    {
        // The results, the count and every facet must see the same search threshold.
        return $filters->q === ''
            ? $this->runList($filters)
            : $this->search->within(fn () => $this->runList($filters));
    }

    /**
     * Header autocomplete: the first products of the Store's relevance order for the query.
     *
     * @param  string  $q  normalized by ProductSearch::normalize(), not empty
     * @return Collection<int, Product>
     */
    public function suggest(string $q): Collection
    {
        return $this->search->within(function () use ($q) {
            $query = $this->catalog();
            $this->search->filter($query, $q);
            $this->applySort($query, new ProductFilters(q: $q, sort: ProductFilters::SORT_RELEVANCE));

            return $query->with(['platform', 'region'])->limit(self::SUGGEST_LIMIT)->get();
        });
    }

    private function runList(ProductFilters $filters): ProductListResult
    {
        $query = $this->applyFilters($this->catalog(), $filters);
        $total = (clone $query)->count();

        $this->applySort($query, $filters);

        $items = $query
            ->with(['platform', 'region'])
            ->forPage($filters->page, ProductFilters::PER_PAGE)
            ->get();

        return new ProductListResult($items, $total, $filters->page, [
            'platforms' => $this->facetCounts($filters, 'platform_id', self::EXCEPT_PLATFORM, Platform::class),
            'regions' => $this->facetCounts($filters, 'region_id', self::EXCEPT_REGION, Region::class),
            'price' => $this->priceRange($filters),
        ]);
    }

    /**
     * The product with its active offers (seller loaded, `stock` = available keys), ordered
     * in stock first, then by price, then id. So the first offer is the best one when any is in stock.
     */
    public function find(string $slug): Product
    {
        $product = $this->catalog()->with(['platform', 'region'])->where('slug', $slug)->first();

        if ($product === null) {
            throw new NotFoundHttpException;
        }

        $offers = $product->offers()
            ->where('is_active', true)
            ->with('seller')
            ->withCount(['keys as stock' => fn (Builder $keys) => $keys->where('status', Key::STATUS_AVAILABLE)])
            ->get()
            ->sortBy([
                fn (Offer $a, Offer $b) => ($b->stock > 0) <=> ($a->stock > 0),
                ['price_cents', 'asc'],
                ['id', 'asc'],
            ])
            ->values();

        $offers->each(fn (Offer $offer) => $offer->setRelation('product', $product));
        $product->setRelation('offers', $offers);

        return $product;
    }

    /**
     * Every product with the derived columns from_price_cents and sales, aliased as `products`.
     * Public so the homepage providers rank and filter on the same from-price as the Store.
     *
     * @return Builder<Product>
     */
    public function catalog(): Builder
    {
        $fromPrice = Offer::query()
            ->selectRaw('min(offers.price_cents)')
            ->whereColumn('offers.product_id', 'products.id')
            ->where('offers.is_active', true)
            ->whereExists(fn (QueryBuilder $keys) => $keys
                ->selectRaw('1')
                ->from('keys')
                ->whereColumn('keys.offer_id', 'offers.id')
                ->where('keys.status', Key::STATUS_AVAILABLE));

        $sales = OrderItem::query()
            ->selectRaw('coalesce(sum(order_items.quantity), 0)::int')
            ->join('offers', 'offers.id', '=', 'order_items.offer_id')
            ->whereColumn('offers.product_id', 'products.id');

        $products = Product::query()
            ->select('products.*')
            ->addSelect(['from_price_cents' => $fromPrice, 'sales' => $sales]);

        // Wrapping lets filters and sorts use the derived columns by name.
        return Product::query()->fromSub($products, 'products');
    }

    /**
     * One filter implementation for the results and every facet, so facet counts can never drift
     * from what the grid shows. `$except` leaves one filter out (disjunctive faceting).
     *
     * @param  Builder<Product>  $query
     * @return Builder<Product>
     */
    private function applyFilters(Builder $query, ProductFilters $filters, ?string $except = null): Builder
    {
        if ($filters->q !== '') {
            $this->search->filter($query, $filters->q);
        }

        if ($except !== self::EXCEPT_PLATFORM && $filters->platforms !== []) {
            $query->whereIn('platform_id', Platform::query()->select('id')->whereIn('slug', $filters->platforms));
        }

        if ($except !== self::EXCEPT_REGION && $filters->regions !== []) {
            $query->whereIn('region_id', Region::query()->select('id')->whereIn('slug', $filters->regions));
        }

        // Comparisons with NULL are never true, so a price bound also drops out-of-stock products.
        if ($except !== self::EXCEPT_PRICE) {
            if ($filters->minPrice !== null) {
                $query->where('from_price_cents', '>=', $filters->minPrice);
            }
            if ($filters->maxPrice !== null) {
                $query->where('from_price_cents', '<=', $filters->maxPrice);
            }
        }

        return $query;
    }

    /** @param Builder<Product> $query */
    private function applySort(Builder $query, ProductFilters $filters): void
    {
        match ($filters->sort) {
            ProductFilters::SORT_PRICE_ASC => $query->orderByRaw('from_price_cents asc nulls last'),
            ProductFilters::SORT_PRICE_DESC => $query->orderByRaw('from_price_cents desc nulls last'),
            ProductFilters::SORT_NEWEST => $query->orderByRaw('release_date desc nulls last'),
            ProductFilters::SORT_RELEVANCE => $this->search->orderByRelevance($query, $filters->q),
            default => null,
        };

        if (in_array($filters->sort, [ProductFilters::SORT_RELEVANCE, ProductFilters::SORT_BESTSELLING], true)) {
            $query->orderByDesc('sales');
        }

        // A unique tiebreaker keeps pages stable.
        $query->orderBy('id');
    }

    /**
     * Every option of the dimension (zero counts included), sorted by name.
     *
     * @param  class-string<Model>  $model
     * @return list<array{slug: string, name: string, count: int}>
     */
    private function facetCounts(ProductFilters $filters, string $column, string $except, string $model): array
    {
        $counts = $this->applyFilters($this->catalog(), $filters, $except)
            ->toBase()
            ->select($column)
            ->selectRaw('count(*) as count')
            ->groupBy($column)
            ->pluck('count', $column);

        return $model::query()
            ->orderBy('name')
            ->get(['id', 'slug', 'name'])
            ->map(fn (Model $option) => [
                'slug' => (string) $option->getAttribute('slug'),
                'name' => (string) $option->getAttribute('name'),
                'count' => (int) ($counts[$option->getKey()] ?? 0),
            ])
            ->values()
            ->all();
    }

    /** @return array{min_cents: int|null, max_cents: int|null} */
    private function priceRange(ProductFilters $filters): array
    {
        $range = $this->applyFilters($this->catalog(), $filters, self::EXCEPT_PRICE)
            ->toBase()
            ->selectRaw('min(from_price_cents) as min_cents, max(from_price_cents) as max_cents')
            ->first();

        return [
            'min_cents' => $range?->min_cents === null ? null : (int) $range->min_cents,
            'max_cents' => $range?->max_cents === null ? null : (int) $range->max_cents,
        ];
    }
}
