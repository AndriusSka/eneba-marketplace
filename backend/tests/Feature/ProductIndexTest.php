<?php

use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\Support\StoreCatalog;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->catalog = StoreCatalog::create();
});

/** @param array<string, mixed> $query */
function listProducts(array $query = []): TestResponse
{
    return test()->getJson('/api/products'.($query === [] ? '' : '?'.http_build_query($query)));
}

/** @return list<string> */
function slugsOf(TestResponse $response): array
{
    return array_column($response->json('data'), 'slug');
}

describe('response shape', function () {
    it('lists every product with its from-price, stock flag, platform and region', function () {
        $response = listProducts()->assertOk();

        expect($response->json('meta'))->toBe(['page' => 1, 'per_page' => 24, 'total' => 6, 'last_page' => 1]);

        $elden = collect($response->json('data'))->firstWhere('slug', 'product-a');
        expect($elden)->toBe([
            'id' => $this->catalog->products['A']->id,
            'slug' => 'product-a',
            'title' => 'Elden Ring',
            'cover_url' => '/placeholders/cover-1.svg',
            'platform' => ['slug' => 'steam', 'name' => 'Steam'],
            'region' => ['slug' => 'global', 'name' => 'Global'],
            'release_date' => '2022-02-25',
            'msrp_cents' => 5999,
            'currency' => 'EUR',
            // 2999 is cheaper, but all its keys are sold.
            'from_price_cents' => 3449,
            'discount_percent' => 42, // floor(100 * 2550 / 5999)
            'in_stock' => true,
        ]);
    });

    it('ignores inactive offers when computing the from-price', function () {
        $cyberpunk = collect(listProducts()->json('data'))->firstWhere('slug', 'product-b');

        expect($cyberpunk['from_price_cents'])->toBe(2999);
    });

    it('marks a product whose offers have no available keys as out of stock', function () {
        $hollow = collect(listProducts()->json('data'))->firstWhere('slug', 'product-d');

        expect($hollow['from_price_cents'])->toBeNull()
            ->and($hollow['discount_percent'])->toBeNull()
            ->and($hollow['in_stock'])->toBeFalse();
    });

    it('gives no discount when the price equals MSRP', function () {
        $forza = collect(listProducts()->json('data'))->firstWhere('slug', 'product-c');

        expect($forza['discount_percent'])->toBeNull();
    });
});

describe('filters', function () {
    it('filters by one platform', function () {
        expect(slugsOf(listProducts(['platform' => ['xbox']])))
            ->toEqualCanonicalizing($this->catalog->slugs(['C', 'D']));
    });

    it('filters by several platforms (OR within a dimension)', function () {
        expect(slugsOf(listProducts(['platform' => ['xbox', 'steam']])))->toHaveCount(6);
    });

    it('filters by region', function () {
        expect(slugsOf(listProducts(['region' => ['eu']])))
            ->toEqualCanonicalizing($this->catalog->slugs(['B', 'D', 'F']));
    });

    it('matches nothing for an unknown slug', function () {
        expect(slugsOf(listProducts(['platform' => ['gameboy']])))->toBe([]);
    });

    it('applies an inclusive minimum price and drops out-of-stock products', function () {
        expect(slugsOf(listProducts(['min_price' => 3449])))
            ->toEqualCanonicalizing($this->catalog->slugs(['A', 'C', 'E', 'F']));
    });

    it('applies an inclusive maximum price and drops out-of-stock products', function () {
        expect(slugsOf(listProducts(['max_price' => 3449])))
            ->toEqualCanonicalizing($this->catalog->slugs(['A', 'B']));
    });

    it('applies a price range', function () {
        expect(slugsOf(listProducts(['min_price' => 3000, 'max_price' => 5000])))
            ->toEqualCanonicalizing($this->catalog->slugs(['A', 'E', 'F']));
    });

    it('filters by name, ignoring case and extra whitespace', function () {
        expect(slugsOf(listProducts(['q' => '  ELDEN   ring '])))
            ->toEqualCanonicalizing($this->catalog->slugs(['A', 'F']));
    });

    it('treats LIKE wildcards in the name filter literally', function (string $q, array $expected) {
        expect(slugsOf(listProducts(['q' => $q])))->toEqualCanonicalizing($this->catalog->slugs($expected));
    })->with([
        'percent' => ['%', ['E']],
        'underscore' => ['_', []],
    ]);

    it('returns an empty page when the name matches nothing', function () {
        $response = listProducts(['q' => 'nonexistent title']);

        expect($response->json('data'))->toBe([])
            ->and($response->json('meta.total'))->toBe(0)
            ->and($response->json('meta.last_page'))->toBe(1);
    });

    it('combines filters with AND across dimensions', function () {
        expect(slugsOf(listProducts(['platform' => ['steam'], 'region' => ['eu'], 'max_price' => 3000])))
            ->toBe($this->catalog->slugs(['B']));
    });
});

describe('sorting', function () {
    it('sorts', function (string $sort, array $expected) {
        expect(slugsOf(listProducts(['sort' => $sort])))->toBe($this->catalog->slugs($expected));
    })->with([
        // out of stock (D) last on both price sorts
        'price ascending' => ['price_asc', ['B', 'A', 'F', 'E', 'C', 'D']],
        'price descending' => ['price_desc', ['C', 'E', 'F', 'A', 'B', 'D']],
        // the gift card (no release date) last
        'newest' => ['newest', ['F', 'A', 'C', 'B', 'D', 'E']],
        // ties (B, E, F have no sales) broken by id
        'best-selling' => ['bestselling', ['C', 'A', 'D', 'B', 'E', 'F']],
    ]);

    it('defaults to best-selling without a name filter', function () {
        expect(slugsOf(listProducts()))->toBe($this->catalog->slugs(['C', 'A', 'D', 'B', 'E', 'F']));
    });

    it('defaults to relevance with a name filter: exact title before title prefix', function () {
        // A is an exact match (tier 0); F only starts with the query (tier 1).
        expect(slugsOf(listProducts(['q' => 'elden ring'])))->toBe($this->catalog->slugs(['A', 'F']));
    });

    it('ranks a title prefix above a word prefix', function () {
        Product::factory()->create(['title' => 'Ring Fit Adventure', 'slug' => 'ring-fit']);

        expect(slugsOf(listProducts(['q' => 'ring']))[0])->toBe('ring-fit');
    });

    it('falls back to best-selling when relevance is asked for without a query', function () {
        expect(slugsOf(listProducts(['sort' => 'relevance'])))
            ->toBe($this->catalog->slugs(['C', 'A', 'D', 'B', 'E', 'F']));
    });
});

describe('pagination', function () {
    beforeEach(function () {
        Product::factory()->count(20)->create(); // 26 products in total
    });

    it('serves 24 products per page', function () {
        $first = listProducts(['sort' => 'newest']);
        $second = listProducts(['sort' => 'newest', 'page' => 2]);

        expect($first->json('data'))->toHaveCount(24)
            ->and($first->json('meta'))->toBe(['page' => 1, 'per_page' => 24, 'total' => 26, 'last_page' => 2])
            ->and($second->json('data'))->toHaveCount(2)
            ->and($second->json('meta.page'))->toBe(2)
            ->and(array_intersect(slugsOf($first), slugsOf($second)))->toBe([]);
    });

    it('returns an empty page past the end, with the real totals', function () {
        $response = listProducts(['page' => 3])->assertOk();

        expect($response->json('data'))->toBe([])
            ->and($response->json('meta'))->toBe(['page' => 3, 'per_page' => 24, 'total' => 26, 'last_page' => 2]);
    });
});

describe('facets', function () {
    it('counts each dimension against every other active filter (disjunctive)', function () {
        $facets = listProducts(['platform' => ['steam'], 'region' => ['eu']])->json('facets');

        // Platforms ignore the platform filter: EU products are B (steam), D (xbox), F (steam).
        expect($facets['platforms'])->toBe([
            ['slug' => 'nintendo', 'name' => 'Nintendo', 'count' => 0],
            ['slug' => 'steam', 'name' => 'Steam', 'count' => 2],
            ['slug' => 'xbox', 'name' => 'Xbox', 'count' => 1],
        ])
            // Regions ignore the region filter: Steam products are A, E (global) and B, F (eu).
            ->and($facets['regions'])->toBe([
                ['slug' => 'eu', 'name' => 'EU', 'count' => 2],
                ['slug' => 'global', 'name' => 'Global', 'count' => 2],
            ])
            // The price range applies both: B and F.
            ->and($facets['price'])->toBe(['min_cents' => 2999, 'max_cents' => 3499]);
    });

    it('applies the name filter to facet counts', function () {
        $facets = listProducts(['q' => 'cyber'])->json('facets');

        expect(collect($facets['platforms'])->pluck('count', 'slug')->all())
            ->toBe(['nintendo' => 0, 'steam' => 1, 'xbox' => 0]);
    });

    it('computes the price range without the price filter', function () {
        expect(listProducts(['min_price' => 4000])->json('facets.price'))
            ->toBe(['min_cents' => 2999, 'max_cents' => 5999]);
    });

    it('reports no price range when nothing is in stock', function () {
        expect(listProducts(['q' => 'hollow'])->json('facets.price'))
            ->toBe(['min_cents' => null, 'max_cents' => null]);
    });
});

describe('validation', function () {
    it('rejects invalid parameters with 422', function (array $query, string $field) {
        listProducts($query)->assertUnprocessable()->assertJsonValidationErrors($field);
    })->with([
        'unknown sort' => [['sort' => 'cheapest'], 'sort'],
        'negative price' => [['min_price' => -1], 'min_price'],
        'non-integer price' => [['max_price' => '9.99'], 'max_price'],
        'max below min' => [['min_price' => 5000, 'max_price' => 1000], 'max_price'],
        'page zero' => [['page' => 0], 'page'],
        'platform not a list' => [['platform' => 'steam'], 'platform'],
        'query too long' => [['q' => str_repeat('a', 101)], 'q'],
    ]);

    it('accepts a max price without a min price', function () {
        listProducts(['max_price' => 1000])->assertOk();
    });
});
