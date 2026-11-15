<?php

namespace App\Http\Requests;

/**
 * The cart lines shared by the quote and checkout: offer ids and quantities only. Anything else
 * a client sends (a price, a total) is not in the rules, so validated() drops it.
 */
trait CartItemsRules
{
    public const MAX_LINES = 20;

    public const MAX_QUANTITY = 10;

    /** @return array<string, mixed> */
    protected function itemRules(): array
    {
        return [
            'items' => ['required', 'array', 'list', 'min:1', 'max:'.self::MAX_LINES],
            // Extra fields on a line (a tampered price) are ignored, not rejected: items() keeps only these two.
            'items.*' => ['required', 'array'],
            'items.*.offer_id' => ['required', 'integer', 'min:1', 'distinct'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:'.self::MAX_QUANTITY],
        ];
    }

    /** @return list<array{offer_id: int, quantity: int}> */
    public function items(): array
    {
        /** @var list<array{offer_id: int|string, quantity: int|string}> $items */
        $items = $this->validated('items');

        return array_map(fn (array $item) => [
            'offer_id' => (int) $item['offer_id'],
            'quantity' => (int) $item['quantity'],
        ], $items);
    }
}
