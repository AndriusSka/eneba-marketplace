<?php

namespace App\Http\Controllers;

use App\Services\Homepage\HomepageService;
use Illuminate\Http\JsonResponse;

final class HomeController extends Controller
{
    public function __invoke(HomepageService $homepage): JsonResponse
    {
        return response()->json(['data' => $homepage->blocks()]);
    }
}
