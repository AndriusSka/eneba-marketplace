<?php

use App\Http\Controllers\HealthController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\SearchController;
use Illuminate\Support\Facades\Route;

Route::get('/health', HealthController::class);

Route::get('/search/suggest', [SearchController::class, 'suggest']);

Route::get('/products', [ProductController::class, 'index']);
// A plain string slug (no model binding), so a 404 never names a model class.
Route::get('/products/{slug}', [ProductController::class, 'show']);
