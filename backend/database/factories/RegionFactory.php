<?php

namespace Database\Factories;

use App\Models\Region;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Region>
 */
class RegionFactory extends Factory
{
    public function definition(): array
    {
        $name = fake()->unique()->country().' '.fake()->unique()->numberBetween(1, 99999);

        return [
            'slug' => Str::slug($name),
            'name' => $name,
        ];
    }
}
