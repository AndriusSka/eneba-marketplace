<?php

namespace Database\Factories;

use App\Models\Platform;
use App\Models\Product;
use App\Models\Region;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    public function definition(): array
    {
        $title = Str::title(fake()->unique()->words(3, true));

        return [
            'slug' => Str::slug($title).'-'.fake()->unique()->numberBetween(1, 999999),
            'title' => $title,
            'platform_id' => Platform::factory(),
            'region_id' => Region::factory(),
            'description' => fake()->paragraph(),
            'cover_url' => '/placeholders/cover-1.svg',
            'release_date' => fake()->dateTimeBetween('-10 years', 'now')->format('Y-m-d'),
            'msrp_cents' => fake()->numberBetween(5, 70) * 100 - 1,
            'currency' => 'EUR',
        ];
    }
}
