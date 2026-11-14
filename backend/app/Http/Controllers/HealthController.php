<?php

namespace App\Http\Controllers;

use App\Services\HealthCheck;
use Illuminate\Http\JsonResponse;

final class HealthController extends Controller
{
    public function __invoke(HealthCheck $health): JsonResponse
    {
        $result = $health->run();

        // 503 lets uptime pingers and Render's health check notice a dead database.
        return response()
            ->json($result, $result['status'] === 'ok' ? 200 : 503)
            ->header('Cache-Control', 'no-store');
    }
}
