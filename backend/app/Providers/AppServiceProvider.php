<?php

namespace App\Providers;

use App\Services\Homepage\BlockProviderRegistry;
use App\Services\Homepage\Providers\BannerProvider;
use App\Services\Homepage\Providers\BestSellersProvider;
use App\Services\Homepage\Providers\DealsProvider;
use Illuminate\Contracts\Foundation\Application;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Homepage block types: `homepage_blocks.type` → provider. A new block type needs one entry
        // here and one in the frontend's blockRegistry.
        $this->app->singleton(BlockProviderRegistry::class, fn (Application $app) => new BlockProviderRegistry($app, [
            'hero_banner' => BannerProvider::class,
            'best_sellers' => BestSellersProvider::class,
            'deals' => DealsProvider::class,
        ]));
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
