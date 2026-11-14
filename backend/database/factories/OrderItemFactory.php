<?php

namespace Database\Factories;

use App\Models\Offer;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OrderItem>
 */
class OrderItemFactory extends Factory
{
    public function definition(): array
    {
        return [
            'order_id' => Order::factory(),
            'offer_id' => Offer::factory(),
            'unit_price_cents' => fake()->numberBetween(199, 6999),
            'quantity' => 1,
        ];
    }
}
