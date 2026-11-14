<?php

namespace App\Services\Catalog;

/** Validated, normalized Store query (GET /api/products). */
final readonly class ProductFilters
{
    public const PER_PAGE = 24;

    public const SORT_RELEVANCE = 'relevance';

    public const SORT_PRICE_ASC = 'price_asc';

    public const SORT_PRICE_DESC = 'price_desc';

    public const SORT_NEWEST = 'newest';

    public const SORT_BESTSELLING = 'bestselling';

    public const SORTS = [
        self::SORT_RELEVANCE,
        self::SORT_PRICE_ASC,
        self::SORT_PRICE_DESC,
        self::SORT_NEWEST,
        self::SORT_BESTSELLING,
    ];

    /**
     * @param  string  $q  normalized by ProductSearch::normalize(); '' means no name filter
     * @param  list<string>  $platforms  platform slugs
     * @param  list<string>  $regions  region slugs
     * @param  int|null  $minPrice  inclusive, cents, on the from-price
     * @param  int|null  $maxPrice  inclusive, cents, on the from-price
     */
    public function __construct(
        public string $q = '',
        public array $platforms = [],
        public array $regions = [],
        public ?int $minPrice = null,
        public ?int $maxPrice = null,
        public string $sort = self::SORT_BESTSELLING,
        public int $page = 1,
    ) {}

    /** Relevance needs a query; without one the Store falls back to best-selling. */
    public static function resolveSort(?string $requested, string $q): string
    {
        $sort = $requested ?? ($q !== '' ? self::SORT_RELEVANCE : self::SORT_BESTSELLING);

        return $sort === self::SORT_RELEVANCE && $q === '' ? self::SORT_BESTSELLING : $sort;
    }
}
