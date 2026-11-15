<?php

use App\Models\Key;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\CheckoutCatalog;

uses(RefreshDatabase::class);

it('prices every line from the database, in the order the cart sent them', function () {
    $a = CheckoutCatalog::offer(keys: 5, priceCents: 1999, title: 'Elden Ring', seller: 'PixelVault');
    $b = CheckoutCatalog::offer(keys: 3, priceCents: 500, title: 'Hades', seller: 'Key Hub');

    $response = $this->postJson('/api/cart/quote', ['items' => [
        ['offer_id' => $b->id, 'quantity' => 2],
        ['offer_id' => $a->id, 'quantity' => 1, 'price_cents' => 1], // a tampered price is ignored
    ]])->assertOk();

    expect($response->json('data'))->toMatchArray([
        'total_cents' => 2 * 500 + 1999,
        'currency' => 'EUR',
        'checkout_ready' => true,
    ]);
    expect($response->json('data.lines.0'))->toMatchArray([
        'offer_id' => $b->id,
        'requested_quantity' => 2,
        'quantity' => 2,
        'stock' => 3,
        'unit_price_cents' => 500,
        'line_total_cents' => 1000,
        'warning' => null,
        'seller' => ['id' => $b->seller->id, 'name' => 'Key Hub'],
    ]);
    expect($response->json('data.lines.0.product'))->toMatchArray([
        'id' => $b->product->id,
        'slug' => $b->product->slug,
        'title' => 'Hades',
    ]);
    expect($response->json('data.lines.1.offer_id'))->toBe($a->id)
        ->and($response->json('data.lines.1.unit_price_cents'))->toBe(1999);
});

it('flags lines that can not be bought, and blocks checkout', function () {
    $short = CheckoutCatalog::offer(keys: 2, priceCents: 1000);
    $soldOut = CheckoutCatalog::offer(keys: 0, priceCents: 700);
    $inactive = CheckoutCatalog::offer(keys: 4, priceCents: 900, active: false);

    $response = $this->postJson('/api/cart/quote', ['items' => [
        ['offer_id' => $short->id, 'quantity' => 5],
        ['offer_id' => $soldOut->id, 'quantity' => 1],
        ['offer_id' => $inactive->id, 'quantity' => 1],
        ['offer_id' => 999999, 'quantity' => 1],
    ]])->assertOk();

    $lines = $response->json('data.lines');
    expect(array_column($lines, 'warning'))->toBe(['quantity_reduced', 'out_of_stock', 'inactive', 'unavailable'])
        ->and(array_column($lines, 'quantity'))->toBe([2, 0, 0, 0])
        ->and(array_column($lines, 'requested_quantity'))->toBe([5, 1, 1, 1])
        ->and(array_column($lines, 'line_total_cents'))->toBe([2000, 0, 0, 0])
        ->and($lines[3]['product'])->toBeNull()
        ->and($lines[3]['seller'])->toBeNull()
        ->and($lines[3]['unit_price_cents'])->toBeNull()
        ->and($response->json('data.total_cents'))->toBe(2000)
        ->and($response->json('data.checkout_ready'))->toBeFalse();
});

it('allows checkout when the only warning is a reduced quantity', function () {
    $offer = CheckoutCatalog::offer(keys: 2);

    $this->postJson('/api/cart/quote', ['items' => [['offer_id' => $offer->id, 'quantity' => 3]]])
        ->assertOk()
        ->assertJsonPath('data.lines.0.warning', 'quantity_reduced')
        ->assertJsonPath('data.checkout_ready', true);
});

it('does not count sold keys as stock', function () {
    $offer = CheckoutCatalog::offer(keys: 3);
    Key::factory()->count(2)->for($offer)->sold()->create();

    $this->postJson('/api/cart/quote', ['items' => [['offer_id' => $offer->id, 'quantity' => 1]]])
        ->assertOk()
        ->assertJsonPath('data.lines.0.stock', 3);
});

it('rejects malformed carts', function (array $body, string $field) {
    $this->postJson('/api/cart/quote', $body)->assertUnprocessable()->assertJsonValidationErrors($field);
})->with([
    'no items' => [[], 'items'],
    'empty cart' => [['items' => []], 'items'],
    '21 lines' => [['items' => array_map(fn ($i) => ['offer_id' => $i, 'quantity' => 1], range(1, 21))], 'items'],
    'quantity 0' => [['items' => [['offer_id' => 1, 'quantity' => 0]]], 'items.0.quantity'],
    'quantity 11' => [['items' => [['offer_id' => 1, 'quantity' => 11]]], 'items.0.quantity'],
    'duplicate offer' => [['items' => [['offer_id' => 1, 'quantity' => 1], ['offer_id' => 1, 'quantity' => 2]]], 'items.0.offer_id'],
    'non-integer offer' => [['items' => [['offer_id' => 'abc', 'quantity' => 1]]], 'items.0.offer_id'],
    'missing quantity' => [['items' => [['offer_id' => 1]]], 'items.0.quantity'],
    'not a list' => [['items' => 'nope'], 'items'],
]);
