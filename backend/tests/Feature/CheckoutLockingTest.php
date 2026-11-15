<?php

use App\Models\Key;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTruncation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\CheckoutCatalog;

// Another transaction must see the rows, so this file commits them (truncation, not a wrapping
// transaction) and clears up afterwards so the RefreshDatabase files start from empty tables.
uses(DatabaseTruncation::class);

const SECOND_CONNECTION = 'pgsql_second_buyer';

beforeEach(function () {
    config(['database.connections.'.SECOND_CONNECTION => config('database.connections.'.config('database.default'))]);
    // If SKIP LOCKED were missing, the checkout would wait on the other buyer's lock forever.
    // This turns that into a fast failure instead of a hung test run.
    DB::statement("SET lock_timeout = '3s'");
});

afterEach(function () {
    DB::connection(SECOND_CONNECTION)->rollBack();
    DB::purge(SECOND_CONNECTION);
    $this->truncateTablesForAllConnections();
});

/** Another buyer, mid-checkout: an open transaction holding FOR UPDATE locks on these keys. */
function lockKeysInAnotherTransaction(array $keyIds): void
{
    $other = DB::connection(SECOND_CONNECTION);
    $other->beginTransaction();
    $locked = $other->table('keys')->whereIn('id', $keyIds)->lock('for update')->pluck('id')->all();
    expect($locked)->toHaveCount(count($keyIds));
}

it('skips keys another checkout has locked and sells the next free one, without waiting', function () {
    $offer = CheckoutCatalog::offer(keys: 2);
    [$first, $second] = Key::where('offer_id', $offer->id)->orderBy('id')->pluck('id')->all();
    lockKeysInAnotherTransaction([$first]);

    $this->actingAs(User::factory()->create(), 'sanctum')
        ->withHeader('Idempotency-Key', (string) Str::uuid())
        ->postJson('/api/checkout', ['items' => [['offer_id' => $offer->id, 'quantity' => 1]], 'card_number' => '4242424242424242'])
        ->assertCreated()
        ->assertJsonPath('data.items.0.keys.0.id', $second);

    expect(Key::find($first)->status)->toBe('available')
        ->and(Key::find($second)->status)->toBe('sold');
});

it('answers 409 at once when every free key is locked by another checkout', function () {
    $offer = CheckoutCatalog::offer(keys: 2);
    lockKeysInAnotherTransaction(Key::where('offer_id', $offer->id)->pluck('id')->all());

    $started = microtime(true);
    $this->actingAs(User::factory()->create(), 'sanctum')
        ->withHeader('Idempotency-Key', (string) Str::uuid())
        ->postJson('/api/checkout', ['items' => [['offer_id' => $offer->id, 'quantity' => 1]], 'card_number' => '4242424242424242'])
        ->assertConflict()
        ->assertJsonPath('code', 'out_of_stock');

    expect(microtime(true) - $started)->toBeLessThan(3.0) // no lock wait
        ->and(CheckoutCatalog::availableKeys($offer))->toBe(2);
});
