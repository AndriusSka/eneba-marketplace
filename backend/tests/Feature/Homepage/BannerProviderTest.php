<?php

use App\Models\Banner;
use App\Services\Homepage\Providers\BannerProvider;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/** @param array<string, mixed> $config */
function banners(array $config = []): array
{
    return app(BannerProvider::class)->fetch($config);
}

it('returns active banners in position order with their display fields', function () {
    $second = Banner::factory()->create(['title' => 'Second', 'position' => 2, 'subtitle' => null]);
    $first = Banner::factory()->create(['title' => 'First', 'position' => 1, 'link_url' => '/store?q=ring']);
    Banner::factory()->create(['title' => 'Hidden', 'position' => 0, 'is_active' => false]);

    expect(banners())->toBe([
        ['id' => $first->id, 'title' => 'First', 'subtitle' => $first->subtitle, 'image_url' => '/placeholders/banner-1.svg', 'link_url' => '/store?q=ring'],
        ['id' => $second->id, 'title' => 'Second', 'subtitle' => null, 'image_url' => '/placeholders/banner-1.svg', 'link_url' => '/store'],
    ]);
});

it('breaks position ties by id', function () {
    $a = Banner::factory()->create(['position' => 1]);
    $b = Banner::factory()->create(['position' => 1]);

    expect(array_column(banners(), 'id'))->toBe([$a->id, $b->id]);
});

it('applies config.limit and clamps it to 1–10', function () {
    Banner::factory()->count(12)->sequence(fn ($s) => ['position' => $s->index])->create();

    expect(banners(['limit' => 2]))->toHaveCount(2)
        ->and(banners(['limit' => 0]))->toHaveCount(1)
        ->and(banners(['limit' => 50]))->toHaveCount(10)
        ->and(banners())->toHaveCount(5)
        ->and(banners(['limit' => 'many']))->toHaveCount(5);
});

it('returns an empty list when no banner is active', function () {
    Banner::factory()->create(['is_active' => false]);

    expect(banners())->toBe([]);
});
