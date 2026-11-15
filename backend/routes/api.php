<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CartController;
use App\Http\Controllers\CheckoutController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\SearchController;
use Illuminate\Support\Facades\Route;

Route::get('/health', HealthController::class);

Route::get('/home', HomeController::class);

Route::get('/search/suggest', [SearchController::class, 'suggest']);

Route::get('/products', [ProductController::class, 'index']);
// A plain string slug (no model binding), so a 404 never names a model class.
Route::get('/products/{slug}', [ProductController::class, 'show']);

// Guests have carts too: the quote is public. It reads prices, it reserves nothing.
Route::post('/cart/quote', [CartController::class, 'quote']);

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// Signed-in only. A guest gets 401 JSON.
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    Route::post('/checkout', [CheckoutController::class, 'store']);
    Route::get('/orders', [OrderController::class, 'index']);
    // A positive integer that fits in int64, so /orders/abc (or a 30-digit id) is the same generic
    // 404 as someone else's order rather than a type error.
    Route::get('/orders/{id}', [OrderController::class, 'show'])->where('id', '[1-9][0-9]{0,17}');
});
