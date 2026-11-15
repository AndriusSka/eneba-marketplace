<?php

namespace App\Http\Resources;

use App\Models\Key;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * An order for its owner. Item `keys` are included only when they were loaded
 * (OrderQueries::withDetails), so the history list carries no key codes.
 *
 * @mixin Order
 */
final class OrderResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status,
            'total_cents' => $this->total_cents,
            'currency' => $this->currency,
            'paid_at' => $this->paid_at?->toIso8601String(),
            'item_count' => (int) $this->items->sum('quantity'),
            'items' => $this->items->map(fn (OrderItem $item) => array_filter([
                'id' => $item->id,
                'offer_id' => $item->offer_id,
                'product' => ProductBrief::of($item->offer->product),
                'seller' => ['id' => $item->offer->seller->id, 'name' => $item->offer->seller->name],
                'unit_price_cents' => $item->unit_price_cents,
                'quantity' => $item->quantity,
                'line_total_cents' => $item->unit_price_cents * $item->quantity,
                'keys' => $item->relationLoaded('keys')
                    ? $item->keys->map(fn (Key $key) => ['id' => $key->id, 'code' => $key->code])->values()->all()
                    : null,
            ], fn ($value) => $value !== null))->values()->all(),
        ];
    }
}
