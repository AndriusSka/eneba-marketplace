<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Platforms, regions, sellers, products, offers and key pools from database/seeders/data/catalog.php.
 * Uses bulk inserts: the database is remote (Neon), so one round trip per row would be slow.
 * Randomness comes from mt_rand, seeded by DatabaseSeeder, so the result is deterministic.
 */
class CatalogSeeder extends Seeder
{
    private const COVER_COUNT = 8;

    private const MIN_OFFERS = 2;

    private const MAX_OFFERS = 5;

    private const MAX_KEYS_PER_OFFER = 15;

    /** Characters for key codes: no 0/O or 1/I, which are easy to misread. */
    private const KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    /** @var array<string, true> */
    private array $usedCodes = [];

    public function run(): void
    {
        $catalog = require __DIR__.'/data/catalog.php';
        $now = now();

        DB::table('platforms')->insert(array_map(fn ($p) => $p + ['created_at' => $now, 'updated_at' => $now], $catalog['platforms']));
        DB::table('regions')->insert(array_map(fn ($r) => $r + ['created_at' => $now, 'updated_at' => $now], $catalog['regions']));
        DB::table('sellers')->insert(array_map(fn ($s) => $s + ['created_at' => $now, 'updated_at' => $now], $catalog['sellers']));

        $platforms = DB::table('platforms')->pluck('id', 'slug');
        $platformNames = DB::table('platforms')->pluck('name', 'slug');
        $regions = DB::table('regions')->pluck('id', 'slug');
        $regionNames = DB::table('regions')->pluck('name', 'slug');
        $sellerIds = DB::table('sellers')->orderBy('id')->pluck('id')->all();

        $productRows = [];
        foreach ($catalog['products'] as $i => $p) {
            $productRows[] = [
                'slug' => Str::slug($p['title'].' '.$platformNames[$p['platform']].' '.$regionNames[$p['region']]),
                'title' => $p['title'],
                'platform_id' => $platforms[$p['platform']],
                'region_id' => $regions[$p['region']],
                'description' => $p['description'],
                'cover_url' => '/placeholders/cover-'.(($i % self::COVER_COUNT) + 1).'.svg',
                'release_date' => $p['release_date'],
                'msrp_cents' => $p['msrp_cents'],
                'currency' => 'EUR',
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }
        DB::table('products')->insert($productRows);
        $productIds = DB::table('products')->pluck('id', 'slug');

        // Offers: 2–5 distinct sellers per product. The first offer is the "anchor": below MSRP for games and stocked,
        // so every in-stock product has a deal candidate and something the order history can sell.
        $offerRows = [];
        $plannedKeys = []; // "productId:sellerId" => key count
        $inactiveAdded = false;
        foreach ($catalog['products'] as $i => $p) {
            $productId = $productIds[$productRows[$i]['slug']];
            $sellers = $sellerIds;
            shuffle($sellers);
            $count = mt_rand(self::MIN_OFFERS, self::MAX_OFFERS);

            foreach (array_slice($sellers, 0, $count) as $n => $sellerId) {
                $offerRows[] = $this->offerRow($productId, $sellerId, $this->price($p, anchor: $n === 0), true, $now);
                $plannedKeys["$productId:$sellerId"] = match (true) {
                    ! empty($p['out_of_stock']) => 0,
                    $n === 0 => mt_rand(6, self::MAX_KEYS_PER_OFFER),
                    default => mt_rand(0, self::MAX_KEYS_PER_OFFER),
                };
            }

            // One inactive offer in the catalog, on the first product with a free seller slot, for the M4/M6 "inactive" paths.
            if (! $inactiveAdded && $count < self::MAX_OFFERS) {
                $sellerId = $sellers[$count];
                $offerRows[] = $this->offerRow($productId, $sellerId, $this->price($p, anchor: false), false, $now);
                $plannedKeys["$productId:$sellerId"] = 3;
                $inactiveAdded = true;
            }
        }
        DB::table('offers')->insert($offerRows);

        $keyRows = [];
        foreach (DB::table('offers')->orderBy('id')->get(['id', 'product_id', 'seller_id']) as $offer) {
            for ($k = 0; $k < $plannedKeys["{$offer->product_id}:{$offer->seller_id}"]; $k++) {
                $keyRows[] = [
                    'offer_id' => $offer->id,
                    'code' => $this->keyCode(),
                    'status' => 'available',
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }
        foreach (array_chunk($keyRows, 500) as $chunk) {
            DB::table('keys')->insert($chunk);
        }

        $this->command?->info(sprintf('Catalog: %d products, %d offers, %d keys.', count($productRows), count($offerRows), count($keyRows)));
    }

    /** @return array<string, mixed> */
    private function offerRow(int $productId, int $sellerId, int $priceCents, bool $active, mixed $now): array
    {
        return [
            'product_id' => $productId,
            'seller_id' => $sellerId,
            'price_cents' => $priceCents,
            'currency' => 'EUR',
            'is_active' => $active,
            'created_at' => $now,
            'updated_at' => $now,
        ];
    }

    /**
     * A seller price relative to MSRP, ending in 9 cents. Gift cards stay near face value;
     * games range from 55% to 110% of MSRP, and the anchor offer is at most 90%.
     *
     * @param  array<string, mixed>  $product
     */
    private function price(array $product, bool $anchor): int
    {
        $percent = match (true) {
            ! empty($product['gift_card']) => mt_rand($anchor ? 92 : 96, 108),
            $anchor => mt_rand(55, 90),
            default => mt_rand(60, 110),
        };
        $cents = intdiv($product['msrp_cents'] * $percent, 100);

        return max(99, intdiv($cents, 10) * 10 + 9);
    }

    /** Format XXXXX-XXXXX-XXXXX. Random (not mt_rand), so codes are not predictable from the seed. */
    private function keyCode(): string
    {
        do {
            $chars = '';
            for ($i = 0; $i < 15; $i++) {
                $chars .= self::KEY_ALPHABET[random_int(0, strlen(self::KEY_ALPHABET) - 1)];
            }
            $code = implode('-', str_split($chars, 5));
        } while (isset($this->usedCodes[$code]));

        $this->usedCodes[$code] = true;

        return $code;
    }
}
