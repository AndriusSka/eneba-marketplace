<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class CheckoutRequest extends FormRequest
{
    use CartItemsRules;

    public const IDEMPOTENCY_HEADER = 'Idempotency-Key';

    /** The header is validated like a field, so a missing or malformed key is a 422 on `idempotency_key`. */
    protected function prepareForValidation(): void
    {
        $this->merge(['idempotency_key' => $this->header(self::IDEMPOTENCY_HEADER)]);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return $this->itemRules() + [
            'card_number' => ['required', 'string', 'max:32'],
            'idempotency_key' => ['required', 'string', 'uuid'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'idempotency_key.required' => 'The Idempotency-Key header is required.',
            'idempotency_key.uuid' => 'The Idempotency-Key header must be a UUID.',
        ];
    }

    public function cardNumber(): string
    {
        return (string) $this->validated('card_number');
    }

    /** Lower-cased, so the same UUID in another case is the same key. */
    public function idempotencyKey(): string
    {
        return strtolower((string) $this->validated('idempotency_key'));
    }
}
