<?php

namespace App\Services\Catalog;

use App\Models\Product;
use Illuminate\Database\Eloquent\Collection;

final readonly class ProductListResult
{
    /**
     * @param  Collection<int, Product>  $items  one page, with from_price_cents and sales attributes
     * @param  array{
     *     platforms: list<array{slug: string, name: string, count: int}>,
     *     regions: list<array{slug: string, name: string, count: int}>,
     *     price: array{min_cents: int|null, max_cents: int|null},
     * }  $facets
     */
    public function __construct(
        public Collection $items,
        public int $total,
        public int $page,
        public array $facets,
    ) {}

    public function lastPage(): int
    {
        return max(1, (int) ceil($this->total / ProductFilters::PER_PAGE));
    }
}
