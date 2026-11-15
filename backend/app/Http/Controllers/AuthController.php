<?php

namespace App\Http\Controllers;

use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Services\Auth\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class AuthController extends Controller
{
    public function __construct(private readonly AuthService $auth) {}

    /** 201 with the new user, who is signed in. */
    public function register(RegisterRequest $request): JsonResponse
    {
        /** @var array{name: string, email: string, password: string} $data */
        $data = $request->safe()->only(['name', 'email', 'password']);
        $user = $this->auth->register($data, $request->session());

        return (new UserResource($user))->response()->setStatusCode(201);
    }

    /** 200 with the user; 422 on bad credentials; 429 once locked out. */
    public function login(LoginRequest $request): UserResource
    {
        $user = $this->auth->login(
            $request->validated('email'),
            $request->validated('password'),
            $request->throttleKey(),
            $request->session(),
        );

        return new UserResource($user);
    }

    public function logout(Request $request): Response
    {
        $this->auth->logout($request->session());

        return response()->noContent();
    }

    public function me(Request $request): UserResource
    {
        return new UserResource($request->user());
    }
}
