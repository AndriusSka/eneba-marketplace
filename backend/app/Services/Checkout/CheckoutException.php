<?php

namespace App\Services\Checkout;

use App\Models\Offer;
use Illuminate\Contracts\Debug\ShouldntReport;
use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * A checkout that can't go ahead, rendered as the API error shape
 * `{message, code, offer_id?}` (ARCHITECTURE.md › API). Thrown inside the transaction, so
 * nothing is saved and every key lock is released. An expected outcome, not a fault: never logged.
 */
final class CheckoutException extends RuntimeException implements ShouldntReport
{
    public const CARD_DECLINED = 'card_declined';

    public const OFFER_UNAVAILABLE = 'offer_unavailable';

    public const OUT_OF_STOCK = 'out_of_stock';

    private function __construct(
        string $message,
        public readonly string $errorCode,
        public readonly int $status,
        public readonly ?int $offerId = null,
    ) {
        parent::__construct($message);
    }

    public static function cardDeclined(): self
    {
        return new self('Your card was declined. You have not been charged.', self::CARD_DECLINED, 402);
    }

    /** @param  Offer|null  $offer  null when no offer has this id */
    public static function offerUnavailable(?Offer $offer, int $offerId): self
    {
        $message = $offer === null
            ? 'An item in your cart is no longer available.'
            : self::name($offer).' is no longer sold.';

        return new self($message, self::OFFER_UNAVAILABLE, 409, $offerId);
    }

    /** @param  int  $available  keys this checkout could claim (fewer than it asked for) */
    public static function outOfStock(Offer $offer, int $available): self
    {
        $message = match ($available) {
            0 => self::name($offer).' is out of stock.',
            1 => self::name($offer).' has only 1 key left.',
            default => self::name($offer)." has only {$available} keys left.",
        };

        return new self($message, self::OUT_OF_STOCK, 409, $offer->id);
    }

    public function render(): JsonResponse
    {
        return response()->json(array_filter([
            'message' => $this->getMessage(),
            'code' => $this->errorCode,
            'offer_id' => $this->offerId,
        ], fn ($value) => $value !== null), $this->status);
    }

    /** "Elden Ring from PixelVault": the product and seller, as the cart shows them. */
    private static function name(Offer $offer): string
    {
        return "{$offer->product->title} from {$offer->seller->name}";
    }
}
