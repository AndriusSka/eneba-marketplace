<?php

namespace App\Http\Resources;

use App\Models\Product;

/** The product on a cart or order line. Expects platform and region to be loaded. */
final class ProductBrief
{
    /** @return array{id: int, slug: string, title: string, cover_url: string, platform: array{slug: string, name: string}, region: array{slug: string, name: string}} */
    public static function of(Product $product): array
    {
        return [
            'id' => $product->id,
            'slug' => $product->slug,
            'title' => $product->title,
            'cover_url' => $product->cover_url,
            'platform' => ['slug' => $product->platform->slug, 'name' => $product->platform->name],
            'region' => ['slug' => $product->region->slug, 'name' => $product->region->name],
        ];
    }
}
