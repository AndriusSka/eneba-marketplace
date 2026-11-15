<?php

namespace App\Services\Checkout;

/**
 * The simulated payment (SPEC.md › Interpretations): Stripe-style test numbers, no provider.
 * Pure, so CheckoutService runs it before taking any lock.
 */
final class TestCards
{
    public const APPROVED = '4242424242424242';

    public const DECLINED = '4000000000000002';

    public const RESULT_APPROVED = 'approved';

    public const RESULT_DECLINED = 'declined';

    public const RESULT_UNKNOWN = 'unknown';

    /** "4242 4242-4242 4242" → approved. Spaces and dashes are ignored, as people type them. */
    public static function check(string $cardNumber): string
    {
        return match (preg_replace('/[\s-]+/', '', $cardNumber)) {
            self::APPROVED => self::RESULT_APPROVED,
            self::DECLINED => self::RESULT_DECLINED,
            default => self::RESULT_UNKNOWN,
        };
    }
}
