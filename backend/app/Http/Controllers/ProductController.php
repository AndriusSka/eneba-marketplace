<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProductIndexRequest;
use App\Http\Resources\ProductDetailResource;
use App\Http\Resources\ProductSummaryResource;
use App\Services\Catalog\ProductCatalog;
use App\Services\Catalog\ProductFilters;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ProductController extends Controller
{
    public function __construct(private readonly ProductCatalog $catalog) {}

    public function index(ProductIndexRequest $request): AnonymousResourceCollection
    {
        $result = $this->catalog->list($request->filters());

        return ProductSummaryResource::collection($result->items)->additional([
            'meta' => [
                'page' => $result->page,
                'per_page' => ProductFilters::PER_PAGE,
                'total' => $result->total,
                'last_page' => $result->lastPage(),
            ],
            'facets' => $result->facets,
        ]);
    }

    public function show(string $slug): ProductDetailResource
    {
        return new ProductDetailResource($this->catalog->find($slug));
    }
}
