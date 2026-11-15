<?php

namespace App\Services\Homepage\Providers;

use App\Models\Banner;
use App\Services\Homepage\BlockConfig;
use App\Services\Homepage\BlockProvider;

/** `hero_banner`: active rows of the `banners` table, in position order. */
final class BannerProvider implements BlockProvider
{
    public function fetch(array $config): array
    {
        return Banner::query()
            ->where('is_active', true)
            ->orderBy('position')
            ->orderBy('id')
            ->limit(BlockConfig::int($config, 'limit', default: 5, min: 1, max: 10))
            ->get()
            ->map(fn (Banner $banner) => [
                'id' => $banner->id,
                'title' => $banner->title,
                'subtitle' => $banner->subtitle,
                'image_url' => $banner->image_url,
                'link_url' => $banner->link_url,
            ])
            ->values()
            ->all();
    }
}
