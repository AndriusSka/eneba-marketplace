<?php

namespace App\Http\Requests;

use App\Services\Catalog\ProductFilters;
use App\Services\ProductSearch;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ProductIndexRequest extends FormRequest
{
    public const MAX_PRICE_CENTS = 1_000_000;

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'q' => ['nullable', 'string', 'max:100'],
            'platform' => ['nullable', 'array', 'max:10'],
            'platform.*' => ['string', 'max:100'],
            'region' => ['nullable', 'array', 'max:10'],
            'region.*' => ['string', 'max:100'],
            'min_price' => ['nullable', 'integer', 'min:0', 'max:'.self::MAX_PRICE_CENTS],
            'max_price' => [
                'nullable', 'integer', 'min:0', 'max:'.self::MAX_PRICE_CENTS,
                Rule::when($this->filled('min_price'), ['gte:min_price']),
            ],
            'sort' => ['nullable', Rule::in(ProductFilters::SORTS)],
            'page' => ['nullable', 'integer', 'min:1', 'max:1000'],
        ];
    }

    public function filters(): ProductFilters
    {
        $data = $this->validated();
        $q = ProductSearch::normalize($data['q'] ?? null);

        return new ProductFilters(
            q: $q,
            platforms: self::slugs($data['platform'] ?? []),
            regions: self::slugs($data['region'] ?? []),
            minPrice: isset($data['min_price']) ? (int) $data['min_price'] : null,
            maxPrice: isset($data['max_price']) ? (int) $data['max_price'] : null,
            sort: ProductFilters::resolveSort($data['sort'] ?? null, $q),
            page: isset($data['page']) ? (int) $data['page'] : 1,
        );
    }

    /**
     * @param  array<mixed>  $values
     * @return list<string>
     */
    private static function slugs(array $values): array
    {
        return array_values(array_unique(array_map(strval(...), $values)));
    }
}
