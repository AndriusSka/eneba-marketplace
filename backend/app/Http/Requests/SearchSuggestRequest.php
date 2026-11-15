<?php

namespace App\Http\Requests;

use App\Services\ProductSearch;
use Illuminate\Foundation\Http\FormRequest;

final class SearchSuggestRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'q' => ['nullable', 'string', 'max:100'],
        ];
    }

    /** The normalized query; '' means there is nothing to suggest. */
    public function searchQuery(): string
    {
        return ProductSearch::normalize($this->validated('q'));
    }
}
