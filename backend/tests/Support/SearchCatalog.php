<?php

namespace Tests\Support;

use App\Models\Key;
use App\Models\Offer;
use App\Models\Platform;
use App\Models\Product;
use App\Models\Region;
use App\Models\Seller;
use Illuminate\Support\Str;

/**
 * The real seeded titles (database/seeders/data/catalog.php), one product each, all in stock and
 * with no sales. Search ranking is tested against these so the distractors are the ones production
 * has. Slug = Str::slug(title), e.g. "the-witcher-3-wild-hunt".
 *
 * Rows are bulk-inserted (one statement per table): the tests run against a remote database, and
 * this fixture is built before every test.
 */
final class SearchCatalog
{
    public static function create(): void
    {
        $data = require database_path('seeders/data/catalog.php');
        $titles = array_values(array_unique(array_column($data['products'], 'title')));

        $platform = Platform::factory()->create();
        $region = Region::factory()->create();
        $seller = Seller::factory()->create();

        Product::insert(array_map(fn (string $title) => Product::factory()->raw([
            'slug' => Str::slug($title),
            'title' => $title,
            'platform_id' => $platform->id,
            'region_id' => $region->id,
        ]), $titles));

        $productIds = Product::query()->pluck('id')->all();
        Offer::insert(array_map(fn (int $id) => Offer::factory()->raw([
            'product_id' => $id,
            'seller_id' => $seller->id,
        ]), $productIds));

        $offerIds = Offer::query()->pluck('id')->all();
        Key::insert(array_map(fn (int $id) => Key::factory()->raw(['offer_id' => $id]), $offerIds));
    }
}
