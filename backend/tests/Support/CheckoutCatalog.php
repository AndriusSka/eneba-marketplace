<?php

namespace Tests\Support;

use App\Models\Key;
use App\Models\Offer;
use App\Models\Product;
use App\Models\Seller;
use Illuminate\Support\Str;

/** Offers with a known number of available keys, for the cart, checkout and order tests. */
final class CheckoutCatalog
{
    /** An offer for "<title>" sold by "<seller>" at `$priceCents`, with `$keys` available keys. */
    public static function offer(
        int $keys,
        int $priceCents = 1999,
        string $title = 'Elden Ring',
        string $seller = 'PixelVault',
        bool $active = true,
        int $msrpCents = 5999,
    ): Offer {
        $offer = Offer::factory()
            ->for(Product::factory()->state(['title' => $title, 'slug' => Str::slug($title).'-'.Str::lower(Str::random(6)), 'msrp_cents' => $msrpCents]))
            ->for(Seller::factory()->state(['name' => $seller]))
            ->state(['price_cents' => $priceCents, 'is_active' => $active])
            ->create();

        Key::factory()->count($keys)->for($offer)->create();

        return $offer;
    }

    public static function availableKeys(Offer $offer): int
    {
        return Key::query()->where('offer_id', $offer->id)->where('status', Key::STATUS_AVAILABLE)->count();
    }
}
