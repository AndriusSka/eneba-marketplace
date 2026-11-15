<?php

namespace App\Http\Controllers;

use App\Http\Requests\CheckoutRequest;
use App\Http\Resources\OrderResource;
use App\Models\User;
use App\Services\Checkout\CheckoutService;
use Illuminate\Http\JsonResponse;

final class CheckoutController extends Controller
{
    public function __construct(private readonly CheckoutService $checkout) {}

    /** 201 with a new order and its keys; 200 with the original order for a repeated Idempotency-Key. */
    public function store(CheckoutRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $result = $this->checkout->checkout(
            $user,
            $request->items(),
            $request->cardNumber(),
            $request->idempotencyKey(),
        );

        return (new OrderResource($result->order))
            ->response()
            ->setStatusCode($result->replayed ? 200 : 201)
            ->header('Cache-Control', OrderController::NO_STORE);
    }
}
