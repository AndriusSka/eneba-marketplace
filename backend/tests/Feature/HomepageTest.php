<?php

use App\Models\Banner;
use App\Models\HomepageBlock;
use App\Services\Homepage\BlockProvider;
use App\Services\Homepage\Providers\DealsProvider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Illuminate\Testing\TestResponse;
use Tests\Support\StoreCatalog;

uses(RefreshDatabase::class);

// StoreCatalog gives best_sellers and deals real data; one banner gives hero_banner data.
beforeEach(function () {
    $this->catalog = StoreCatalog::create();
    Banner::factory()->create(['title' => 'Welcome', 'position' => 1]);
});

/** @param array<string, mixed> $attributes */
function block(string $type, int $position, array $attributes = []): HomepageBlock
{
    return HomepageBlock::factory()->create(['type' => $type, 'position' => $position] + $attributes + ['config' => []]);
}

function home(): TestResponse
{
    return test()->getJson('/api/home')->assertOk();
}

/** @return list<string> */
function typesOf(TestResponse $response): array
{
    return array_column($response->json('data'), 'type');
}

it('returns each block with its id, type, title, link and data', function () {
    $hero = block('hero_banner', 1, ['title' => 'Featured']);
    $best = block('best_sellers', 2, ['title' => 'Best sellers', 'config' => ['limit' => 1, 'link_url' => '/store?sort=bestselling']]);

    $response = home();

    expect($response->json('data'))->toHaveCount(2)
        ->and($response->json('data.0'))->toMatchArray(['id' => $hero->id, 'type' => 'hero_banner', 'title' => 'Featured', 'link_url' => null])
        ->and($response->json('data.0.data.0.title'))->toBe('Welcome')
        ->and($response->json('data.1'))->toMatchArray(['id' => $best->id, 'type' => 'best_sellers', 'title' => 'Best sellers', 'link_url' => '/store?sort=bestselling'])
        ->and(array_column($response->json('data.1.data'), 'slug'))->toBe($this->catalog->slugs(['C']));
});

it('orders blocks by position, so reordering is a database update', function () {
    $deals = block('deals', 1);
    block('hero_banner', 2);
    $best = block('best_sellers', 3);

    expect(typesOf(home()))->toBe(['deals', 'hero_banner', 'best_sellers']);

    $deals->update(['position' => 3]);
    $best->update(['position' => 1]);

    expect(typesOf(home()))->toBe(['best_sellers', 'hero_banner', 'deals']);
});

it('hides inactive blocks', function () {
    block('hero_banner', 1);
    block('deals', 2, ['is_active' => false]);

    expect(typesOf(home()))->toBe(['hero_banner']);
});

it('skips an unknown block type and logs a warning', function () {
    Log::spy();
    block('hero_banner', 1);
    $mystery = block('countdown', 2);
    block('deals', 3);

    expect(typesOf(home()))->toBe(['hero_banner', 'deals']);

    Log::shouldHaveReceived('warning')->once()
        ->with('Homepage block skipped: unknown type', ['block_id' => $mystery->id, 'type' => 'countdown']);
});

it('leaves out a block whose provider throws, logs it, and still returns the others', function () {
    Log::spy();
    app()->instance(DealsProvider::class, new class implements BlockProvider
    {
        public function fetch(array $config): array
        {
            throw new RuntimeException('deals are down');
        }
    });
    block('hero_banner', 1);
    $deals = block('deals', 2);
    block('best_sellers', 3);

    expect(typesOf(home()))->toBe(['hero_banner', 'best_sellers']);

    Log::shouldHaveReceived('error')->once()->withArgs(
        fn (string $message, array $context) => $message === 'Homepage block skipped: provider failed'
            && $context['block_id'] === $deals->id
            && $context['exception'] instanceof RuntimeException,
    );
});

it('leaves out a block whose provider cannot be built, logs it, and still returns the others', function () {
    Log::spy();
    app()->bind(DealsProvider::class, fn () => throw new RuntimeException('cannot build deals'));
    block('hero_banner', 1);
    $deals = block('deals', 2);
    block('best_sellers', 3);

    expect(typesOf(home()))->toBe(['hero_banner', 'best_sellers']);

    Log::shouldHaveReceived('error')->once()->withArgs(
        fn (string $message, array $context) => $message === 'Homepage block skipped: provider failed'
            && $context['block_id'] === $deals->id
            && $context['exception'] instanceof RuntimeException,
    );
});

it('leaves out a block with nothing to show', function () {
    Banner::query()->update(['is_active' => false]);
    block('hero_banner', 1);
    block('deals', 2);

    expect(typesOf(home()))->toBe(['deals']);
});

it('returns an empty list when no block is active', function () {
    block('deals', 1, ['is_active' => false]);

    expect(home()->json())->toBe(['data' => []]);
});

it('passes on a block config that is not an object as an empty config', function () {
    block('deals', 1, ['config' => ['not', 'an', 'object']]);

    expect(typesOf(home()))->toBe(['deals']);
});

it('only passes on link_url when it is a same-site path', function (mixed $link, ?string $expected) {
    block('deals', 1, ['config' => ['link_url' => $link]]);

    expect(home()->json('data.0.link_url'))->toBe($expected);
})->with([
    'store path' => ['/store?sort=bestselling', '/store?sort=bestselling'],
    'absolute URL' => ['https://example.com', null],
    'protocol-relative URL' => ['//example.com', null],
    'backslash trick' => ['/\\example.com', null],
    'tab trick (browsers drop the tab)' => ["/\t/example.com", null],
    'newline trick' => ["/\n/example.com", null],
    'javascript URL' => ['javascript:alert(1)', null],
    'not a string' => [42, null],
]);
