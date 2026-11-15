<?php

namespace App\Services\Checkout;

use App\Models\Offer;

/** One cart line priced from the database. */
final readonly class CartQuoteLine
{
    /** The offer exists but is switched off. */
    public const INACTIVE = 'inactive';

    /** No offer has this id (a stale cart). */
    public const UNAVAILABLE = 'unavailable';

    public const OUT_OF_STOCK = 'out_of_stock';

    /** More was asked for than is in stock: `quantity` is the stock. */
    public const QUANTITY_REDUCED = 'quantity_reduced';

    /**
     * @param  int  $quantity  what can be bought now (0 for an unbuyable line)
     * @param  Offer|null  $offer  with product (platform, region) and seller loaded; null when it doesn't exist
     */
    public function __construct(
        public int $offerId,
        public int $requestedQuantity,
        public int $quantity,
        public int $stock,
        public ?Offer $offer,
        public ?string $warning,
    ) {}

    /** A line that blocks checkout until it is removed from the cart. */
    public function blocksCheckout(): bool
    {
        return $this->warning !== null && $this->warning !== self::QUANTITY_REDUCED;
    }

    public function lineTotalCents(): int
    {
        return $this->offer === null ? 0 : $this->offer->price_cents * $this->quantity;
    }
}
