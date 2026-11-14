<?php

namespace Database\Factories;

use App\Models\Order;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Order>
 */
class OrderFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'status' => Order::STATUS_PAID,
            'total_cents' => fake()->numberBetween(199, 19999),
            'currency' => 'EUR',
            'idempotency_key' => fake()->uuid(),
            'paid_at' => now(),
        ];
    }
}
