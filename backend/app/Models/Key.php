<?php

namespace App\Models;

use Database\Factories\KeyFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['offer_id', 'code', 'status', 'order_item_id', 'sold_at'])]
class Key extends Model
{
    /** @use HasFactory<KeyFactory> */
    use HasFactory;

    public const STATUS_AVAILABLE = 'available';

    public const STATUS_SOLD = 'sold';

    protected function casts(): array
    {
        return [
            'sold_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Offer, $this> */
    public function offer(): BelongsTo
    {
        return $this->belongsTo(Offer::class);
    }

    /** @return BelongsTo<OrderItem, $this> */
    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class);
    }
}
