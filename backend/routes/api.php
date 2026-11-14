<?php

use App\Http\Controllers\HealthController;
use App\Http\Controllers\ProductController;
use Illuminate\Support\Facades\Route;

Route::get('/health', HealthController::class);

Route::get('/products', [ProductController::class, 'index']);
// A plain string slug (no model binding), so a 404 never names a model class.
Route::get('/products/{slug}', [ProductController::class, 'show']);
