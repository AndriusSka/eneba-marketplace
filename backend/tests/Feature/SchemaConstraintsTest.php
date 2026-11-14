<?php

use App\Models\Key;
use App\Models\Offer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Seller;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';

// The database, not only the application, refuses invalid states. One violation per case:
// a failed statement aborts the surrounding test transaction.
it('rejects invalid writes', function (Closure $write, string $sqlState, string $constraint) {
    try {
        $write();
    } catch (QueryException $e) {
        expect($e->getCode())->toBe($sqlState)
            ->and($e->getMessage())->toContain($constraint);

        return;
    }

    $this->fail("Expected the database to reject the write with {$constraint}.");
})->with([
    'duplicate key code' => [function () {
        Key::factory()->create(['code' => 'AAAAA-BBBBB-CCCCC']);
        Key::factory()->create(['code' => 'AAAAA-BBBBB-CCCCC']);
    }, UNIQUE_VIOLATION, 'keys_code_unique'],
    'sold key without an order line' => [fn () => Key::factory()->create(['status' => Key::STATUS_SOLD, 'sold_at' => now()]),
        CHECK_VIOLATION, 'keys_sold_has_order_item'],
    'available key attached to an order line' => [fn () => Key::factory()->create(['order_item_id' => OrderItem::factory()]),
        CHECK_VIOLATION, 'keys_sold_has_order_item'],
    'unknown key status' => [fn () => Key::factory()->create(['status' => 'reserved']),
        CHECK_VIOLATION, 'keys_status_valid'],
    'negative offer price' => [fn () => Offer::factory()->create(['price_cents' => -100]),
        CHECK_VIOLATION, 'offers_price_positive'],
    'zero offer price' => [fn () => Offer::factory()->create(['price_cents' => 0]),
        CHECK_VIOLATION, 'offers_price_positive'],
    'non-EUR offer' => [fn () => Offer::factory()->create(['currency' => 'USD']),
        CHECK_VIOLATION, 'offers_currency_eur'],
    'non-EUR order' => [fn () => Order::factory()->create(['currency' => 'USD']),
        CHECK_VIOLATION, 'orders_currency_eur'],
    'two offers from one seller on one product' => [function () {
        $offer = Offer::factory()->create();
        Offer::factory()->create(['product_id' => $offer->product_id, 'seller_id' => $offer->seller_id]);
    }, UNIQUE_VIOLATION, 'offers_product_id_seller_id_unique'],
    'zero MSRP' => [fn () => Product::factory()->create(['msrp_cents' => 0]),
        CHECK_VIOLATION, 'products_msrp_positive'],
    'seller rating above 5' => [fn () => Seller::factory()->create(['rating' => '5.50']),
        CHECK_VIOLATION, 'sellers_rating_range'],
    'order line quantity 0' => [fn () => OrderItem::factory()->create(['quantity' => 0]),
        CHECK_VIOLATION, 'order_items_quantity_range'],
    'unknown order status' => [fn () => Order::factory()->create(['status' => 'refunded']),
        CHECK_VIOLATION, 'orders_status_valid'],
    'idempotency key reused by one user' => [function () {
        $order = Order::factory()->create();
        Order::factory()->create(['user_id' => $order->user_id, 'idempotency_key' => $order->idempotency_key]);
    }, UNIQUE_VIOLATION, 'orders_user_id_idempotency_key_unique'],
]);

it('accepts a sold key attached to its order line', function () {
    $item = OrderItem::factory()->create();

    $key = Key::factory()->sold($item)->create(['offer_id' => $item->offer_id]);

    expect($key->fresh()->status)->toBe(Key::STATUS_SOLD)
        ->and($key->orderItem->is($item))->toBeTrue();
});

it('has the indexes that search, filters, sorts and checkout rely on', function () {
    $indexes = DB::table('pg_indexes')->where('schemaname', 'public')->pluck('indexdef', 'indexname');

    expect($indexes)->toHaveKeys([
        'products_title_trgm',
        'products_platform_id_index',
        'products_region_id_index',
        'products_release_date_index',
        'offers_active_product_price',
        'offers_seller_id_index',
        'keys_available_offer',
        'keys_order_item_id_index',
        'orders_paid_at_index',
        'orders_user_id_created_at_index',
        'order_items_offer_id_index',
        'banners_active_position',
        'homepage_blocks_active_position',
    ])
        ->and($indexes['products_title_trgm'])->toContain('gin')->toContain('lower((title)::text) gin_trgm_ops')
        ->and($indexes['keys_available_offer'])->toContain("WHERE ((status)::text = 'available'::text)");
});
