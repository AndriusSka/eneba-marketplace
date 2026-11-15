<?php

namespace App\Http\Controllers;

use App\Http\Resources\OrderResource;
use App\Models\User;
use App\Services\Orders\OrderQueries;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class OrderController extends Controller
{
    /** Responses with key codes must never be stored by a browser or a proxy. */
    public const NO_STORE = 'no-store, private';

    public function __construct(private readonly OrderQueries $orders) {}

    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return OrderResource::collection($this->orders->listFor($user))
            ->response()
            ->header('Cache-Control', self::NO_STORE);
    }

    /** 404 for an order that doesn't exist or belongs to someone else. */
    public function show(Request $request, int $id): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return (new OrderResource($this->orders->findFor($user, $id)))
            ->response()
            ->header('Cache-Control', self::NO_STORE);
    }
}
