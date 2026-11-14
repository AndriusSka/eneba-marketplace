<?php

namespace Database\Factories;

use App\Models\Banner;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Banner>
 */
class BannerFactory extends Factory
{
    public function definition(): array
    {
        return [
            'title' => fake()->sentence(4),
            'subtitle' => fake()->sentence(8),
            'image_url' => '/placeholders/banner-1.svg',
            'link_url' => '/store',
            'position' => fake()->numberBetween(1, 100),
            'is_active' => true,
        ];
    }
}
