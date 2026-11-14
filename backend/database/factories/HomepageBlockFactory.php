<?php

namespace Database\Factories;

use App\Models\HomepageBlock;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<HomepageBlock>
 */
class HomepageBlockFactory extends Factory
{
    public function definition(): array
    {
        return [
            'type' => fake()->randomElement(['hero_banner', 'best_sellers', 'deals']),
            'title' => fake()->sentence(3),
            'position' => fake()->numberBetween(1, 100),
            'is_active' => true,
            'config' => ['limit' => 12],
        ];
    }
}
