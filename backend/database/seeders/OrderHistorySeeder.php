<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Users and past paid orders, so "best sellers" has data and the demo account has history.
 * Every order line claims real keys from the pool, exactly as checkout would: the keys become
 * `sold`, point at their order line and are no longer counted as stock.
 *
 * Orders are planned in memory and written with a handful of bulk statements: the database is
 * remote, and one round trip per row made seeding take over ten seconds.
 */
class OrderHistorySeeder extends Seeder
{
    /** The search-test titles also lead the sales chart. */
    private const FLAGSHIP_SLUGS = [
        'the-witcher-3-wild-hunt-steam-global',
        'cyberpunk-2077-steam-global',
        'elden-ring-steam-global',
        'red-dead-redemption-2-steam-global',
        'minecraft-xbox-global',
    ];

    private const FLAGSHIP_WEIGHT = 6;

    private const ORDER_COUNT = 20;

    private const DEMO_ORDER_COUNT = 4;

    private const MAX_DAYS_AGO = 25;

    public const DEMO_EMAIL = 'demo@example.com';

    public const DEMO_PASSWORD = 'password';

    public function run(): void
    {
        $now = now();
        $users = [['name' => 'Demo User', 'email' => self::DEMO_EMAIL, 'password' => Hash::make(self::DEMO_PASSWORD)]];
        foreach (range(1, 4) as $n) {
            // Nobody signs in as these; they only make the sales numbers look like a shop.
            $users[] = ['name' => "Shopper {$n}", 'email' => "shopper{$n}@example.com", 'password' => Hash::make(Str::random(40))];
        }
        DB::table('users')->insert(array_map(fn ($u) => $u + ['created_at' => $now, 'updated_at' => $now], $users));
        $userIds = DB::table('users')->whereIn('email', array_column($users, 'email'))->pluck('id', 'email');
        $demoId = $userIds[self::DEMO_EMAIL];
        $shopperIds = $userIds->except(self::DEMO_EMAIL)->values()->all();

        // Available keys of active offers, grouped per product and offer, cheapest offer first.
        $pool = [];   // productId => [offerId => [keyId, ...]]
        $prices = []; // offerId => price_cents
        $rows = DB::table('keys')
            ->join('offers', 'offers.id', '=', 'keys.offer_id')
            ->where('offers.is_active', true)
            ->where('keys.status', 'available')
            ->orderBy('offers.price_cents')->orderBy('offers.id')->orderBy('keys.id')
            ->get(['keys.id as key_id', 'offers.id as offer_id', 'offers.product_id', 'offers.price_cents']);
        foreach ($rows as $row) {
            $pool[$row->product_id][$row->offer_id][] = $row->key_id;
            $prices[$row->offer_id] = $row->price_cents;
        }

        // Weighted draw list: flagship products appear several times, so they sell most.
        $flagshipIds = DB::table('products')->whereIn('slug', self::FLAGSHIP_SLUGS)->pluck('id')->all();
        $draw = [];
        foreach (array_keys($pool) as $productId) {
            $weight = in_array($productId, $flagshipIds, true) ? self::FLAGSHIP_WEIGHT : 1;
            array_push($draw, ...array_fill(0, $weight, $productId));
        }

        // Plan: idempotency key => order row, plus its lines (offerId => quantity and claimed key ids).
        $orders = [];
        $linesByOrder = [];
        for ($o = 0; $o < self::ORDER_COUNT; $o++) {
            $lines = [];
            $wanted = mt_rand(1, 3);
            for ($attempt = 0; count($lines) < $wanted && $attempt < 20; $attempt++) {
                $productId = $draw[mt_rand(0, count($draw) - 1)];
                $offerId = $this->cheapestStockedOffer($pool, $productId);
                if ($offerId === null || isset($lines[$offerId])) {
                    continue;
                }
                $quantity = min(mt_rand(1, 2), count($pool[$productId][$offerId]));
                $lines[$offerId] = ['quantity' => $quantity, 'keys' => array_splice($pool[$productId][$offerId], 0, $quantity)];
            }
            if ($lines === []) {
                continue;
            }

            $paidAt = $now->copy()->subDays(mt_rand(1, self::MAX_DAYS_AGO))->subMinutes(mt_rand(0, 1439))->startOfMinute();
            $idempotencyKey = (string) Str::uuid();
            $orders[$idempotencyKey] = [
                'user_id' => $o < self::DEMO_ORDER_COUNT ? $demoId : $shopperIds[mt_rand(0, count($shopperIds) - 1)],
                'status' => 'paid',
                'total_cents' => array_sum(array_map(fn ($offerId, $line) => $prices[$offerId] * $line['quantity'], array_keys($lines), $lines)),
                'currency' => 'EUR',
                'idempotency_key' => $idempotencyKey,
                'paid_at' => $paidAt,
                'created_at' => $paidAt,
                'updated_at' => $paidAt,
            ];
            $linesByOrder[$idempotencyKey] = $lines;
        }

        DB::table('orders')->insert(array_values($orders));
        $orderIds = DB::table('orders')->whereIn('idempotency_key', array_keys($orders))->pluck('id', 'idempotency_key');

        $items = [];
        foreach ($linesByOrder as $idempotencyKey => $lines) {
            foreach ($lines as $offerId => $line) {
                $items[] = [
                    'order_id' => $orderIds[$idempotencyKey],
                    'offer_id' => $offerId,
                    'unit_price_cents' => $prices[$offerId],
                    'quantity' => $line['quantity'],
                    'created_at' => $orders[$idempotencyKey]['paid_at'],
                    'updated_at' => $orders[$idempotencyKey]['paid_at'],
                ];
            }
        }
        DB::table('order_items')->insert($items);
        $itemIds = DB::table('order_items')->whereIn('order_id', $orderIds->values())->get(['id', 'order_id', 'offer_id'])
            ->mapWithKeys(fn ($i) => ["{$i->order_id}:{$i->offer_id}" => $i->id]);

        // Mark every claimed key sold in one statement.
        $values = [];
        $bindings = [];
        foreach ($linesByOrder as $idempotencyKey => $lines) {
            foreach ($lines as $offerId => $line) {
                $itemId = $itemIds["{$orderIds[$idempotencyKey]}:{$offerId}"];
                foreach ($line['keys'] as $keyId) {
                    $values[] = '(?::bigint, ?::bigint, ?::timestamp)';
                    array_push($bindings, $keyId, $itemId, $orders[$idempotencyKey]['paid_at']->toDateTimeString());
                }
            }
        }
        DB::update(
            "UPDATE keys SET status = 'sold', order_item_id = v.item_id, sold_at = v.sold_at, updated_at = v.sold_at
             FROM (VALUES ".implode(', ', $values).') AS v(key_id, item_id, sold_at)
             WHERE keys.id = v.key_id',
            $bindings,
        );

        $this->command?->info(sprintf('Order history: %d orders, %d keys sold. Demo login: %s', count($orders), count($values), self::DEMO_EMAIL));
    }

    /** @param  array<int, array<int, list<int>>>  $pool */
    private function cheapestStockedOffer(array $pool, int $productId): ?int
    {
        foreach ($pool[$productId] ?? [] as $offerId => $keys) {
            if ($keys !== []) {
                return $offerId;
            }
        }

        return null;
    }
}
