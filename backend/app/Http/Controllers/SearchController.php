<?php

namespace App\Http\Controllers;

use App\Http\Requests\SearchSuggestRequest;
use App\Http\Resources\ProductSummaryResource;
use App\Services\Catalog\ProductCatalog;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class SearchController extends Controller
{
    public function __construct(private readonly ProductCatalog $catalog) {}

    /** Header autocomplete: `{data: ProductSummary[]}`, at most 6, in the Store's relevance order. */
    public function suggest(SearchSuggestRequest $request): AnonymousResourceCollection
    {
        $q = $request->searchQuery();

        return ProductSummaryResource::collection($q === '' ? [] : $this->catalog->suggest($q));
    }
}
