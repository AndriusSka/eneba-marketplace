<?php

use App\Models\Order;
use App\Models\OrderItem;
use App\Services\Homepage\Providers\BestSellersProvider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\StoreCatalog;

uses(RefreshDatabase::class);

// StoreCatalog's orders are all paid now: C sold 5, A sold 3, D sold 2 but is sold out,
// and B, E and F have no sales.
beforeEach(function () {
    $this->catalog = StoreCatalog::create();
});

/** @param array<string, mixed> $config */
function bestSellers(array $config = []): array
{
    return app(BestSellersProvider::class)->fetch($config);
}

it('ranks in-stock products by units sold and leaves out unsold and sold-out ones', function () {
    expect(array_column(bestSellers(), 'slug'))->toBe($this->catalog->slugs(['C', 'A']));
});

it('returns Store card fields, including the from-price', function () {
    $elden = bestSellers()[1];

    expect($elden)->toMatchArray([
        'slug' => 'product-a',
        'platform' => ['slug' => 'steam', 'name' => 'Steam'],
        'region' => ['slug' => 'global', 'name' => 'Global'],
        'from_price_cents' => 3449,
        'discount_percent' => 42,
        'in_stock' => true,
    ]);
});

it('only counts orders paid inside the config.days window', function () {
    // F sells 9 units on an order paid 40 days ago: enough to lead, but outside a 30-day window.
    $old = Order::factory()->create(['paid_at' => now()->subDays(40)]);
    OrderItem::factory()->create(['order_id' => $old->id, 'offer_id' => $this->catalog->offers['F1']->id, 'quantity' => 9]);

    expect(array_column(bestSellers(['days' => 30]), 'slug'))->toBe($this->catalog->slugs(['C', 'A']))
        ->and(array_column(bestSellers(['days' => 60]), 'slug'))->toBe($this->catalog->slugs(['F', 'C', 'A']));
});

it('sums units across offers and orders of the same product', function () {
    // A gains 3 more units on its second offer: 6 in total, ahead of C's 5.
    OrderItem::factory()->create(['offer_id' => $this->catalog->offers['A2']->id, 'quantity' => 3]);

    expect(array_column(bestSellers(), 'slug'))->toBe($this->catalog->slugs(['A', 'C']));
});

it('breaks ties on units by product id', function () {
    // A gains 2 units: 5, the same as C. A was created first.
    OrderItem::factory()->create(['offer_id' => $this->catalog->offers['A1']->id, 'quantity' => 2]);

    expect(array_column(bestSellers(), 'slug'))->toBe($this->catalog->slugs(['A', 'C']));
});

it('applies config.limit', function () {
    expect(array_column(bestSellers(['limit' => 1]), 'slug'))->toBe($this->catalog->slugs(['C']));
});

it('returns an empty list when nothing sold in the window', function () {
    Order::query()->update(['paid_at' => now()->subDays(100)]);

    expect(bestSellers(['days' => 90]))->toBe([]);
});
