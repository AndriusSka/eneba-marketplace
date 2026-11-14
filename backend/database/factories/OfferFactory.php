<?php

namespace Database\Factories;

use App\Models\Offer;
use App\Models\Product;
use App\Models\Seller;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Offer>
 */
class OfferFactory extends Factory
{
    public function definition(): array
    {
        return [
            'product_id' => Product::factory(),
            'seller_id' => Seller::factory(),
            'price_cents' => fake()->numberBetween(199, 6999),
            'currency' => 'EUR',
            'is_active' => true,
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }
}
