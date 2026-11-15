<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\SearchController;
use Illuminate\Support\Facades\Route;

Route::get('/health', HealthController::class);

Route::get('/home', HomeController::class);

Route::get('/search/suggest', [SearchController::class, 'suggest']);

Route::get('/products', [ProductController::class, 'index']);
// A plain string slug (no model binding), so a 404 never names a model class.
Route::get('/products/{slug}', [ProductController::class, 'show']);

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// Signed-in only. A guest gets 401 JSON. Checkout and orders join this group in M6.
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
});
