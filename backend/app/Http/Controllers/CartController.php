<?php

namespace App\Http\Controllers;

use App\Http\Requests\CartQuoteRequest;
use App\Http\Resources\CartQuoteResource;
use App\Services\Checkout\CartQuoteService;

final class CartController extends Controller
{
    public function __construct(private readonly CartQuoteService $quotes) {}

    /** Public: guests have carts too. */
    public function quote(CartQuoteRequest $request): CartQuoteResource
    {
        return new CartQuoteResource($this->quotes->quote($request->items()));
    }
}
