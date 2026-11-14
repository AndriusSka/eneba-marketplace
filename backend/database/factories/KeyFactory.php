<?php

namespace Database\Factories;

use App\Models\Key;
use App\Models\Offer;
use App\Models\OrderItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Key>
 */
class KeyFactory extends Factory
{
    public function definition(): array
    {
        return [
            'offer_id' => Offer::factory(),
            'code' => fake()->unique()->regexify('[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}'),
            'status' => Key::STATUS_AVAILABLE,
            'order_item_id' => null,
            'sold_at' => null,
        ];
    }

    /** A key sold on the given order line (or a new one for the same offer). */
    public function sold(?OrderItem $item = null): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => Key::STATUS_SOLD,
            'order_item_id' => $item?->id ?? OrderItem::factory()->state(['offer_id' => $attributes['offer_id']]),
            'sold_at' => now(),
        ]);
    }
}
