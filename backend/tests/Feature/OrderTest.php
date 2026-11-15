<?php

use App\Models\User;
use App\Services\Checkout\CheckoutService;
use App\Services\Checkout\TestCards;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\CheckoutCatalog;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->offer = CheckoutCatalog::offer(keys: 10, priceCents: 1500, title: 'Elden Ring', seller: 'PixelVault');
});

function buy(User $user, int $offerId, int $quantity = 1): int
{
    return app(CheckoutService::class)
        ->checkout($user, [['offer_id' => $offerId, 'quantity' => $quantity]], TestCards::APPROVED, (string) Str::uuid())
        ->order->id;
}

it('lists only the user\'s own orders, newest first, without key codes', function () {
    $older = buy($this->user, $this->offer->id, 2);
    $newer = buy($this->user, $this->offer->id);
    buy(User::factory()->create(), $this->offer->id);
    // Same timestamp for both: the id breaks the tie.
    DB::table('orders')->whereIn('id', [$older, $newer])->update(['created_at' => now()->subDay()]);

    $response = $this->actingAs($this->user, 'sanctum')->getJson('/api/orders')->assertOk();

    expect(array_column($response->json('data'), 'id'))->toBe([$newer, $older])
        ->and($response->json('data.1.item_count'))->toBe(2)
        ->and($response->json('data.1.total_cents'))->toBe(3000)
        ->and($response->json('data.1.items.0.product.title'))->toBe('Elden Ring')
        ->and($response->json('data.1.items.0'))->not->toHaveKey('keys')
        ->and($response->headers->get('Cache-Control'))->toContain('no-store');
});

it('shows an order with its keys', function () {
    $orderId = buy($this->user, $this->offer->id, 2);

    $response = $this->actingAs($this->user, 'sanctum')->getJson("/api/orders/{$orderId}")->assertOk();

    expect($response->json('data'))->toMatchArray(['id' => $orderId, 'status' => 'paid', 'total_cents' => 3000, 'currency' => 'EUR'])
        ->and($response->json('data.items.0'))->toMatchArray([
            'offer_id' => $this->offer->id,
            'seller' => ['id' => $this->offer->seller->id, 'name' => 'PixelVault'],
            'unit_price_cents' => 1500,
            'quantity' => 2,
            'line_total_cents' => 3000,
        ])
        ->and($response->json('data.items.0.keys'))->toHaveCount(2)
        ->and($response->headers->get('Cache-Control'))->toContain('no-store');
});

it('answers the same 404 for someone else\'s order, a missing one and a non-numeric id', function (string $path) {
    $theirs = buy(User::factory()->create(), $this->offer->id);

    $this->actingAs($this->user, 'sanctum')
        ->getJson(str_replace('{theirs}', (string) $theirs, $path))
        ->assertNotFound()
        ->assertExactJson(['message' => 'Not found.']);
})->with([
    'someone else\'s' => ['/api/orders/{theirs}'],
    'missing' => ['/api/orders/999999'],
    'non-numeric' => ['/api/orders/abc'],
    'too long' => ['/api/orders/123456789012345678901234567890'],
]);
