<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class CartQuoteRequest extends FormRequest
{
    use CartItemsRules;

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return $this->itemRules();
    }
}
