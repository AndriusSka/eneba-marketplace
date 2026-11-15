<?php

use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Tests\Support\SearchCatalog;

uses(RefreshDatabase::class);

beforeEach(function () {
    SearchCatalog::create();
});

function search(string $q): TestResponse
{
    return test()->getJson('/api/products?'.http_build_query(['q' => $q]))->assertOk();
}

function suggest(?string $q): TestResponse
{
    return test()->getJson('/api/search/suggest'.($q === null ? '' : '?'.http_build_query(['q' => $q])));
}

describe('ranking', function () {
    // (query => expected first slug). Scores in comments are word_similarity on the seeded titles,
    // see ARCHITECTURE.md › Search approach. The threshold is 0.35.
    it('puts the right product first', function (string $q, string $expected) {
        expect(search($q)->json('data.0.slug'))->toBe($expected);
    })->with([
        // The four acceptance cases.
        'whole word' => ['witcher', 'the-witcher-3-wild-hunt'],
        'transposed letters (0.400, lowest true match)' => ['wticher', 'the-witcher-3-wild-hunt'],
        'title prefix' => ['elden', 'elden-ring'],
        'missing letter' => ['cyberpnk', 'cyberpunk-2077'],
        // Typos and partial names.
        'typo in a two-word query' => ['eldn ring', 'elden-ring'],
        'missing letter, short word' => ['witcer', 'the-witcher-3-wild-hunt'],
        'prefix while typing' => ['cyberp', 'cyberpunk-2077'],
        'word prefix' => ['ring', 'elden-ring'],
        'swapped letters' => ['minecarft', 'minecraft'],
        'missing letter at the end' => ['hollow knigt', 'hollow-knight'],
        'missing letter, long title' => ['gost of tsushima', 'ghost-of-tsushima-directors-cut'],
        'words from the middle of the title' => ['tears of kingdom', 'the-legend-of-zelda-tears-of-the-kingdom'],
        'four-letter typo (0.400, at the boundary)' => ['fiaf', 'fifa-23'],
        // Normalization.
        'case' => ['FIFA', 'fifa-23'],
        'case and whitespace' => ['  ELDEN   ring ', 'elden-ring'],
    ]);

    it('ranks the closer of two fuzzy matches first', function () {
        // "starfeild" is a typo of Starfield (0.500); Stardew Valley shares "star" (0.400).
        expect(array_column(search('starfeild')->json('data'), 'slug'))
            ->toBe(['starfield', 'stardew-valley']);
    });
});

describe('no results', function () {
    it('finds nothing for a query that matches no title', function (string $q) {
        $response = search($q);

        expect($response->json('data'))->toBe([])
            ->and($response->json('meta.total'))->toBe(0);
    })->with([
        'keyboard mash' => ['qwerty'],
        'nonsense' => ['xyzzy'],
        // These score 0.333 against a seeded title: they pin the threshold from above.
        'banana (Baldur\'s Gate 3, 0.333)' => ['banana'],
        'fortnite (Forza Horizon 5, 0.333)' => ['fortnite'],
        'valorant (Stardew Valley, 0.333)' => ['valorant'],
        'a game we do not sell' => ['call of duty'],
    ]);
});

describe('suggest', function () {
    it('returns at most 6 products in the Store relevance order', function () {
        $suggestions = suggest('a')->assertOk()->json('data');
        $listing = search('a')->json('data');

        expect(count($listing))->toBeGreaterThan(6)
            ->and(array_column($suggestions, 'slug'))->toBe(array_slice(array_column($listing, 'slug'), 0, 6));
    });

    it('finds typos like the Store does', function () {
        expect(suggest('wticher')->assertOk()->json('data.0.slug'))->toBe('the-witcher-3-wild-hunt');
    });

    it('returns product summaries', function () {
        expect(array_keys(suggest('elden')->json('data.0')))->toBe([
            'id', 'slug', 'title', 'cover_url', 'platform', 'region', 'release_date', 'msrp_cents',
            'currency', 'from_price_cents', 'discount_percent', 'in_stock',
        ]);
    });

    it('returns nothing for an empty or blank query', function (?string $q) {
        expect(suggest($q)->assertOk()->json('data'))->toBe([]);
    })->with([
        'missing' => [null],
        'empty' => [''],
        'blank' => ['   '],
    ]);

    it('returns nothing when nothing matches', function () {
        expect(suggest('qwerty')->assertOk()->json('data'))->toBe([]);
    });

    it('rejects a query over 100 characters', function () {
        suggest(str_repeat('a', 101))->assertUnprocessable()->assertJsonValidationErrors('q');
    });
});

it('serves the fuzzy search from the products_title_trgm GIN index', function () {
    // Capture the real page query the Store runs for a typo.
    $page = null;
    DB::listen(function (QueryExecuted $query) use (&$page) {
        if (str_contains($query->sql, '<%') && str_contains($query->sql, 'limit')) {
            $page = $query;
        }
    });
    search('wticher');
    expect($page)->not->toBeNull();

    // 30 rows always seq-scan; turn that off to see whether the index can serve the query.
    // RefreshDatabase's transaction scopes both settings to this test.
    DB::statement('set local enable_seqscan = off');
    DB::select("select set_config('pg_trgm.word_similarity_threshold', '0.35', true)");
    $plan = implode("\n", array_map(
        fn (object $row) => $row->{'QUERY PLAN'},
        DB::select('explain '.$page->sql, $page->bindings),
    ));

    expect($plan)->toContain('Bitmap Index Scan on products_title_trgm')
        ->and($plan)->toContain('%>'); // the word-similarity branch is an index condition too
});
