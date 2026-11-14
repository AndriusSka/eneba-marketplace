<?php

use App\Models\Seller;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\StoreCatalog;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->catalog = StoreCatalog::create();
});

it('returns the product details', function () {
    $product = $this->catalog->products['A'];

    $response = $this->getJson('/api/products/product-a')->assertOk();

    expect($response->json('data'))->toMatchArray([
        'id' => $product->id,
        'slug' => 'product-a',
        'title' => 'Elden Ring',
        'description' => $product->description,
        'platform' => ['slug' => 'steam', 'name' => 'Steam'],
        'region' => ['slug' => 'global', 'name' => 'Global'],
        'release_date' => '2022-02-25',
        'msrp_cents' => 5999,
        'currency' => 'EUR',
        'from_price_cents' => 3449,
        'discount_percent' => 42,
        'in_stock' => true,
    ]);
});

it('lists offers in stock first, then by price, with stock that excludes sold keys', function () {
    $offers = $this->getJson('/api/products/product-a')->json('data.offers');

    expect(array_column($offers, 'id'))->toBe([
        $this->catalog->offers['A1']->id, // 3449, 3 keys
        $this->catalog->offers['A2']->id, // 4500, 2 keys
        $this->catalog->offers['A3']->id, // 2999, cheapest but sold out
    ])
        ->and(array_column($offers, 'stock'))->toBe([3, 2, 0])
        ->and(array_column($offers, 'in_stock'))->toBe([true, true, false])
        ->and(array_column($offers, 'discount_percent'))->toBe([42, 24, 50]);
});

it('shows a sold-out offer with zero stock', function () {
    $offers = $this->getJson('/api/products/product-d')->json('data.offers');

    expect($offers)->toHaveCount(2)
        ->and(array_column($offers, 'price_cents'))->toBe([999, 1299])
        ->and(array_column($offers, 'stock'))->toBe([0, 0])
        ->and(array_column($offers, 'in_stock'))->toBe([false, false])
        ->and($this->getJson('/api/products/product-d')->json('data.in_stock'))->toBeFalse();
});

it('leaves inactive offers out', function () {
    $offers = $this->getJson('/api/products/product-b')->json('data.offers');

    expect(array_column($offers, 'id'))->toBe([$this->catalog->offers['B1']->id]);
});

it('includes the seller name and a numeric rating', function () {
    Seller::query()->whereKey($this->catalog->offers['C1']->seller_id)->update(['name' => 'PixelVault', 'rating' => '4.80']);

    $offer = $this->getJson('/api/products/product-c')->json('data.offers.0');

    expect($offer)->toBe([
        'id' => $this->catalog->offers['C1']->id,
        'seller' => ['id' => $this->catalog->offers['C1']->seller_id, 'name' => 'PixelVault', 'rating' => 4.8],
        'price_cents' => 5999,
        'currency' => 'EUR',
        'discount_percent' => null,
        'stock' => 2,
        'in_stock' => true,
    ]);
});

it('returns 404 with a generic message for an unknown slug', function () {
    $this->getJson('/api/products/does-not-exist')
        ->assertNotFound()
        ->assertExactJson(['message' => 'Not found.']);
});
