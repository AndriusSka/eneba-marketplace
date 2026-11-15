<?php

use App\Models\Key;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\User;
use App\Services\Checkout\CheckoutService;
use App\Services\Checkout\TestCards;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\Support\CheckoutCatalog;

uses(RefreshDatabase::class);

const APPROVED_CARD = '4242 4242 4242 4242';
const DECLINED_CARD = '4000 0000 0000 0002';

beforeEach(function () {
    $this->user = User::factory()->create();
});

/** POST /api/checkout as `$user` (the test's user by default) with a fresh or given Idempotency-Key. */
function postCheckout(array $items, string $card = APPROVED_CARD, ?string $key = null, ?User $user = null, array $extra = []): TestResponse
{
    return test()
        ->actingAs($user ?? test()->user, 'sanctum')
        ->withHeader('Idempotency-Key', $key ?? (string) Str::uuid())
        ->postJson('/api/checkout', ['items' => $items, 'card_number' => $card] + $extra);
}

function nothingSaved(): void
{
    expect(Order::count())->toBe(0)
        ->and(OrderItem::count())->toBe(0)
        ->and(Key::where('status', Key::STATUS_SOLD)->count())->toBe(0);
}

describe('a successful purchase', function () {
    it('sells the keys, links them to the order lines and totals the database prices', function () {
        $a = CheckoutCatalog::offer(keys: 5, priceCents: 1999);
        $b = CheckoutCatalog::offer(keys: 3, priceCents: 500, title: 'Hades', seller: 'Key Hub');

        $response = postCheckout([
            ['offer_id' => $b->id, 'quantity' => 2],
            ['offer_id' => $a->id, 'quantity' => 1],
        ])->assertCreated();

        $order = Order::sole();
        expect($order->user_id)->toBe($this->user->id)
            ->and($order->status)->toBe('paid')
            ->and($order->total_cents)->toBe(1999 + 2 * 500)
            ->and($order->paid_at)->not->toBeNull();

        foreach ([[$a, 1, 1999], [$b, 2, 500]] as [$offer, $quantity, $price]) {
            $item = OrderItem::where('offer_id', $offer->id)->sole();
            expect($item->order_id)->toBe($order->id)
                ->and($item->quantity)->toBe($quantity)
                ->and($item->unit_price_cents)->toBe($price);

            $sold = Key::where('order_item_id', $item->id)->get();
            expect($sold)->toHaveCount($quantity)
                ->and($sold->pluck('status')->unique()->all())->toBe(['sold'])
                ->and($sold->every(fn (Key $key) => $key->sold_at !== null))->toBeTrue();
        }
        expect(CheckoutCatalog::availableKeys($a))->toBe(4)
            ->and(CheckoutCatalog::availableKeys($b))->toBe(1);

        // The response is the order with its key codes, and is never cached.
        expect($response->headers->get('Cache-Control'))->toContain('no-store');
        $response->assertJsonPath('data.id', $order->id)
            ->assertJsonPath('data.total_cents', 2999)
            ->assertJsonPath('data.item_count', 3);
        $codes = collect($response->json('data.items'))->flatMap(fn ($item) => array_column($item['keys'], 'code'));
        expect($codes->sort()->values()->all())
            ->toBe(Key::where('status', 'sold')->pluck('code')->sort()->values()->all());
    });

    it('takes the oldest available keys first', function () {
        $offer = CheckoutCatalog::offer(keys: 3);
        $firstTwo = Key::where('offer_id', $offer->id)->orderBy('id')->limit(2)->pluck('id')->all();

        postCheckout([['offer_id' => $offer->id, 'quantity' => 2]])->assertCreated();

        expect(Key::where('status', 'sold')->orderBy('id')->pluck('id')->all())->toBe($firstTwo);
    });

    it('ignores prices and totals sent by the client', function () {
        $offer = CheckoutCatalog::offer(keys: 2, priceCents: 4999);

        postCheckout(
            [['offer_id' => $offer->id, 'quantity' => 2, 'price_cents' => 1, 'unit_price_cents' => 1]],
            extra: ['total_cents' => 2, 'total' => 2],
        )->assertCreated()->assertJsonPath('data.total_cents', 9998);

        expect(Order::sole()->total_cents)->toBe(9998)
            ->and(OrderItem::sole()->unit_price_cents)->toBe(4999);
    });

    it('accepts the test card typed with dashes', function () {
        $offer = CheckoutCatalog::offer(keys: 1);

        postCheckout([['offer_id' => $offer->id, 'quantity' => 1]], card: '4242-4242-4242-4242')->assertCreated();
    });
});

describe('payment', function () {
    it('declines 4000 0000 0000 0002 with 402, saving nothing and leaving the keys available', function () {
        $offer = CheckoutCatalog::offer(keys: 2);

        postCheckout([['offer_id' => $offer->id, 'quantity' => 2]], card: DECLINED_CARD)
            ->assertStatus(402)
            ->assertExactJson(['message' => 'Your card was declined. You have not been charged.', 'code' => 'card_declined']);

        nothingSaved();
        expect(CheckoutCatalog::availableKeys($offer))->toBe(2);
    });

    it('rejects a card that is not a test card with 422 on card_number', function () {
        $offer = CheckoutCatalog::offer(keys: 1);

        postCheckout([['offer_id' => $offer->id, 'quantity' => 1]], card: '5555 5555 5555 4444')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('card_number');

        nothingSaved();
    });
});

describe('stock', function () {
    it('answers 409 out_of_stock naming the offer when there are not enough keys', function () {
        $offer = CheckoutCatalog::offer(keys: 1, title: 'Elden Ring', seller: 'PixelVault');

        postCheckout([['offer_id' => $offer->id, 'quantity' => 2]])
            ->assertConflict()
            ->assertExactJson([
                'message' => 'Elden Ring from PixelVault has only 1 key left.',
                'code' => 'out_of_stock',
                'offer_id' => $offer->id,
            ]);

        nothingSaved();
        expect(CheckoutCatalog::availableKeys($offer))->toBe(1);
    });

    it('takes nothing from earlier lines when a later line is short', function () {
        $plenty = CheckoutCatalog::offer(keys: 5);
        $short = CheckoutCatalog::offer(keys: 1, title: 'Hades', seller: 'Key Hub');
        expect($plenty->id)->toBeLessThan($short->id); // the plenty line is claimed first

        postCheckout([
            ['offer_id' => $plenty->id, 'quantity' => 3],
            ['offer_id' => $short->id, 'quantity' => 2],
        ])->assertConflict()->assertJsonPath('offer_id', $short->id);

        nothingSaved();
        expect(CheckoutCatalog::availableKeys($plenty))->toBe(5);
    });

    it('answers 409 when the offer sells out between the cart and the payment', function () {
        $offer = CheckoutCatalog::offer(keys: 2, title: 'Elden Ring', seller: 'PixelVault');
        $items = [['offer_id' => $offer->id, 'quantity' => 2]];

        // The cart page says both keys are there.
        $this->postJson('/api/cart/quote', ['items' => $items])
            ->assertJsonPath('data.lines.0.stock', 2)
            ->assertJsonPath('data.checkout_ready', true);

        // Another buyer takes them while this user is typing the card number.
        $other = User::factory()->create();
        app(CheckoutService::class)->checkout($other, $items, TestCards::APPROVED, (string) Str::uuid());

        postCheckout($items)
            ->assertConflict()
            ->assertJsonPath('code', 'out_of_stock')
            ->assertJsonPath('message', 'Elden Ring from PixelVault is out of stock.');

        expect(Order::count())->toBe(1)
            ->and(Order::sole()->user_id)->toBe($other->id);

        // The cart, refreshed, now shows why.
        $this->postJson('/api/cart/quote', ['items' => $items])
            ->assertJsonPath('data.lines.0.warning', 'out_of_stock')
            ->assertJsonPath('data.checkout_ready', false);
    });

    it('answers 409 offer_unavailable for an inactive offer', function () {
        $offer = CheckoutCatalog::offer(keys: 3, active: false, title: 'Hades', seller: 'Key Hub');

        postCheckout([['offer_id' => $offer->id, 'quantity' => 1]])
            ->assertConflict()
            ->assertExactJson([
                'message' => 'Hades from Key Hub is no longer sold.',
                'code' => 'offer_unavailable',
                'offer_id' => $offer->id,
            ]);

        nothingSaved();
    });

    it('answers 409 offer_unavailable for an offer that does not exist', function () {
        postCheckout([['offer_id' => 999999, 'quantity' => 1]])
            ->assertConflict()
            ->assertJsonPath('code', 'offer_unavailable')
            ->assertJsonPath('offer_id', 999999);

        nothingSaved();
    });
});

describe('idempotency', function () {
    it('returns the original order with 200 for the same Idempotency-Key, without selling more keys', function () {
        $offer = CheckoutCatalog::offer(keys: 5);
        $key = (string) Str::uuid();
        $items = [['offer_id' => $offer->id, 'quantity' => 2]];

        $first = postCheckout($items, key: $key)->assertCreated();
        $second = postCheckout($items, key: $key)->assertOk();

        expect($second->json('data'))->toBe($first->json('data'))
            ->and(Order::count())->toBe(1)
            ->and(CheckoutCatalog::availableKeys($offer))->toBe(3);
    });

    it('replays the original order even if the retry carries a different cart or card', function () {
        $offer = CheckoutCatalog::offer(keys: 5);
        $key = (string) Str::uuid();

        $first = postCheckout([['offer_id' => $offer->id, 'quantity' => 1]], key: $key)->assertCreated();
        postCheckout([['offer_id' => $offer->id, 'quantity' => 3]], card: DECLINED_CARD, key: strtoupper($key))
            ->assertOk()
            ->assertJsonPath('data.id', $first->json('data.id'));

        expect(CheckoutCatalog::availableKeys($offer))->toBe(4);
    });

    it('scopes the key to the user: another user with the same key gets their own order', function () {
        $offer = CheckoutCatalog::offer(keys: 5);
        $key = (string) Str::uuid();
        $items = [['offer_id' => $offer->id, 'quantity' => 1]];

        postCheckout($items, key: $key)->assertCreated();
        postCheckout($items, key: $key, user: User::factory()->create())->assertCreated();

        expect(Order::count())->toBe(2);
    });

    it('lets a declined attempt be retried with the same key', function () {
        $offer = CheckoutCatalog::offer(keys: 1);
        $key = (string) Str::uuid();
        $items = [['offer_id' => $offer->id, 'quantity' => 1]];

        postCheckout($items, card: DECLINED_CARD, key: $key)->assertStatus(402);
        postCheckout($items, key: $key)->assertCreated();
    });
});

describe('validation', function () {
    it('requires a UUID Idempotency-Key header', function (?string $header) {
        $offer = CheckoutCatalog::offer(keys: 1);

        $request = $this->actingAs($this->user, 'sanctum');
        if ($header !== null) {
            $request->withHeader('Idempotency-Key', $header);
        }
        $request->postJson('/api/checkout', ['items' => [['offer_id' => $offer->id, 'quantity' => 1]], 'card_number' => APPROVED_CARD])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('idempotency_key');

        nothingSaved();
    })->with(['missing' => [null], 'not a uuid' => ['retry-1'], 'empty' => ['']]);

    it('rejects a malformed checkout', function (array $body, string $field) {
        $this->actingAs($this->user, 'sanctum')
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/checkout', $body)
            ->assertUnprocessable()
            ->assertJsonValidationErrors($field);
    })->with([
        'no card' => [['items' => [['offer_id' => 1, 'quantity' => 1]]], 'card_number'],
        'empty cart' => [['items' => [], 'card_number' => APPROVED_CARD], 'items'],
        'quantity 11' => [['items' => [['offer_id' => 1, 'quantity' => 11]], 'card_number' => APPROVED_CARD], 'items.0.quantity'],
        'duplicate offer' => [['items' => [['offer_id' => 1, 'quantity' => 1], ['offer_id' => 1, 'quantity' => 1]], 'card_number' => APPROVED_CARD], 'items.0.offer_id'],
    ]);
});
