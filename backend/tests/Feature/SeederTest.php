<?php

use App\Models\Key;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Database\Seeders\OrderHistorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(fn () => $this->seed());

it('seeds the requested catalog shape', function () {
    expect(DB::table('platforms')->orderBy('id')->pluck('name')->all())->toBe(['Steam', 'Xbox', 'PlayStation', 'Nintendo'])
        ->and(DB::table('regions')->orderBy('id')->pluck('name')->all())->toBe(['Global', 'EU', 'North America'])
        ->and(DB::table('sellers')->count())->toBe(5)
        ->and(Product::count())->toBe(30)
        ->and(DB::table('banners')->count())->toBe(3)
        ->and(DB::table('homepage_blocks')->orderBy('position')->pluck('type')->all())->toBe(['hero_banner', 'best_sellers', 'deals']);
});

it('gives every product at least 2 active offers and at most 5 offers', function () {
    $products = Product::query()
        ->withCount(['offers', 'offers as active_offers_count' => fn ($q) => $q->where('is_active', true)])
        ->get();

    expect($products)->toHaveCount(30);
    foreach ($products as $product) {
        expect($product->active_offers_count)->toBeGreaterThanOrEqual(2, "{$product->slug} has fewer than 2 active offers")
            ->and($product->offers_count)->toBeLessThanOrEqual(5, "{$product->slug} has more than 5 offers");
    }
});

it('gives every product its own cover file, and every banner an image that exists', function () {
    $public = dirname(base_path()).'/frontend/public';
    $covers = Product::pluck('cover_url', 'slug');

    foreach ($covers as $slug => $url) {
        // Run `php scripts/generate-covers.php` after adding or renaming a product.
        expect($url)->toBe("/covers/{$slug}.svg")
            ->and(is_file($public.$url))->toBeTrue("Missing cover {$url}");
    }
    foreach (DB::table('banners')->pluck('image_url') as $url) {
        expect(is_file($public.$url))->toBeTrue("Missing banner {$url}");
    }
});

it('includes the titles the search tests depend on', function () {
    $slugs = [
        'the-witcher-3-wild-hunt-steam-global',
        'cyberpunk-2077-steam-global',
        'elden-ring-steam-global',
        'red-dead-redemption-2-steam-global',
        'minecraft-xbox-global',
        'fifa-23-steam-global',
    ];

    expect(Product::whereIn('slug', $slugs)->pluck('slug')->sort()->values()->all())->toBe(collect($slugs)->sort()->values()->all());
});

it('has out-of-stock products, deals and an inactive offer to exercise those paths', function () {
    $stockPerProduct = DB::table('products')
        ->leftJoin('offers', 'offers.product_id', '=', 'products.id')
        ->leftJoin('keys', fn ($j) => $j->on('keys.offer_id', '=', 'offers.id')->where('keys.status', Key::STATUS_AVAILABLE))
        ->groupBy('products.id')
        ->selectRaw('products.id, count(keys.id) as stock')
        ->pluck('stock', 'id');

    $belowMsrp = DB::table('offers')
        ->join('products', 'products.id', '=', 'offers.product_id')
        ->where('offers.is_active', true)
        ->whereColumn('offers.price_cents', '<', 'products.msrp_cents')
        ->count();

    expect($stockPerProduct->filter(fn ($stock) => $stock === 0))->toHaveCount(2)
        ->and($belowMsrp)->toBeGreaterThan(0)
        ->and(DB::table('offers')->where('is_active', false)->count())->toBe(1);
});

it('seeds past orders consistent with the keys they sold', function () {
    $orders = Order::with('items.keys')->get();

    expect($orders)->not->toBeEmpty()
        ->and($orders->every(fn (Order $o) => $o->paid_at->isAfter(now()->subDays(30))))->toBeTrue()
        ->and(User::where('email', OrderHistorySeeder::DEMO_EMAIL)->first()->orders()->count())->toBeGreaterThan(0);

    foreach ($orders as $order) {
        expect($order->total_cents)->toBe($order->items->sum(fn ($item) => $item->unit_price_cents * $item->quantity));
        foreach ($order->items as $item) {
            expect($item->keys)->toHaveCount($item->quantity)
                ->and($item->keys->every(fn (Key $key) => $key->status === Key::STATUS_SOLD && $key->sold_at !== null))->toBeTrue();
        }
    }

    expect(Key::where('status', Key::STATUS_SOLD)->count())->toBe((int) DB::table('order_items')->sum('quantity'));
});

it('does nothing when run a second time', function () {
    $tables = ['platforms', 'regions', 'sellers', 'products', 'offers', 'keys', 'users', 'orders', 'order_items', 'banners', 'homepage_blocks'];
    $counts = fn () => collect($tables)->mapWithKeys(fn ($t) => [$t => DB::table($t)->count()])->all();
    $before = $counts();

    $this->seed();

    expect($counts())->toBe($before);
});
