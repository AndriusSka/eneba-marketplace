<?php

use App\Services\Homepage\Providers\DealsProvider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\StoreCatalog;

uses(RefreshDatabase::class);

// Discount of each product's from-price against its MSRP, in StoreCatalog:
// A 42% (3449 / 5999), B 40% (2999 / 4999), F 12% (3499 / 3999), E 4% (4800 / 5000),
// C 0% (sold at MSRP), D sold out.
// Traps: A's cheaper offer at 2999 has no keys left (it would be 50%), and B's offer at 999 is
// inactive (it would be 80%).
beforeEach(function () {
    $this->catalog = StoreCatalog::create();
});

/** @param array<string, mixed> $config */
function deals(array $config = []): array
{
    return app(DealsProvider::class)->fetch($config);
}

it('lists only products priced below MSRP, biggest discount first', function () {
    expect(array_column(deals(), 'slug'))->toBe($this->catalog->slugs(['A', 'B', 'F', 'E']));
});

it('prices each deal from the cheapest active in-stock offer, not sold-out or inactive ones', function () {
    $deals = collect(deals())->keyBy('slug');

    expect($deals['product-a']['from_price_cents'])->toBe(3449)
        ->and($deals['product-a']['discount_percent'])->toBe(42)
        ->and($deals['product-b']['from_price_cents'])->toBe(2999)
        ->and($deals['product-b']['discount_percent'])->toBe(40);
});

it('keeps a product exactly at config.min_discount and drops one just below it', function () {
    // F's discount floors to 12%, the same rounding as discount_percent on the card.
    expect(array_column(deals(['min_discount' => 12]), 'slug'))->toBe($this->catalog->slugs(['A', 'B', 'F']))
        ->and(array_column(deals(['min_discount' => 13]), 'slug'))->toBe($this->catalog->slugs(['A', 'B']));
});

it('agrees with the discount_percent it returns', function () {
    foreach (deals(['min_discount' => 10]) as $deal) {
        expect($deal['discount_percent'])->toBeGreaterThanOrEqual(10)
            ->and($deal['from_price_cents'])->toBeLessThan($deal['msrp_cents']);
    }
});

it('applies config.limit', function () {
    expect(array_column(deals(['limit' => 2]), 'slug'))->toBe($this->catalog->slugs(['A', 'B']));
});

it('returns an empty list when no discount reaches the threshold', function () {
    expect(deals(['min_discount' => 50]))->toBe([]);
});
