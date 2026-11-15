<?php

use App\Models\Key;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTruncation;
use Illuminate\Process\Pool;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Str;
use Tests\Support\CheckoutCatalog;

// Real parallel buyers: separate OS processes, each with its own database connection, all firing
// at the same moment. They must see committed rows, so this file uses truncation instead of a
// wrapping transaction, and clears up afterwards so the RefreshDatabase files start empty.
uses(DatabaseTruncation::class);

afterEach(function () {
    $this->truncateTablesForAllConnections();
});

/**
 * Runs `checkout:simulate` once per buyer, in parallel, and returns each worker's JSON outcome.
 *
 * @param  list<array{user: int, key?: string}>  $buyers
 * @return list<array{result: string, order_id: int|null}>
 */
function raceForOffer(int $offerId, array $buyers): array
{
    // Far enough ahead for every worker to boot Laravel and connect first.
    $startAt = (int) floor(microtime(true) * 1000) + 6000;

    $results = Process::pool(function (Pool $pool) use ($buyers, $offerId, $startAt) {
        foreach ($buyers as $buyer) {
            $command = [PHP_BINARY, 'artisan', 'checkout:simulate', (string) $buyer['user'], (string) $offerId, '--qty=1', "--start-at={$startAt}", '--env=testing'];
            if (isset($buyer['key'])) {
                $command[] = "--key={$buyer['key']}";
            }
            $pool->path(base_path())->timeout(60)->command($command);
        }
    })->start()->wait();

    return array_map(function ($result) {
        expect($result->successful())->toBeTrue($result->errorOutput());
        $lines = array_values(array_filter(explode("\n", trim($result->output()))));

        return json_decode((string) end($lines), true, flags: JSON_THROW_ON_ERROR);
    }, $results->collect()->values()->all());
}

it('sells each key once when buyers race for the same offer', function (int $keys, int $buyers) {
    $offer = CheckoutCatalog::offer(keys: $keys);
    $users = User::factory()->count($buyers)->create();

    $outcomes = raceForOffer($offer->id, $users->map(fn (User $user) => ['user' => $user->id])->all());

    $results = array_count_values(array_column($outcomes, 'result'));
    expect($results)->toEqual(['created' => $keys, 'out_of_stock' => $buyers - $keys])
        ->and(Order::count())->toBe($keys)
        ->and((int) OrderItem::sum('quantity'))->toBe($keys)
        ->and(CheckoutCatalog::availableKeys($offer))->toBe(0);

    $sold = Key::where('offer_id', $offer->id)->where('status', 'sold')->get();
    expect($sold)->toHaveCount($keys)
        ->and($sold->pluck('order_item_id')->unique())->toHaveCount($keys); // one key per order line, none shared
})->with([
    '20 buyers, 5 keys' => [5, 20],
    'two buyers, the last key' => [1, 2],
]);

it('creates one order when the same request arrives many times at once', function () {
    $offer = CheckoutCatalog::offer(keys: 20);
    $user = User::factory()->create();
    $key = (string) Str::uuid();

    $outcomes = raceForOffer($offer->id, array_fill(0, 10, ['user' => $user->id, 'key' => $key]));

    $order = Order::sole();
    expect(array_count_values(array_column($outcomes, 'result')))->toEqual(['created' => 1, 'replayed' => 9])
        ->and(array_unique(array_column($outcomes, 'order_id')))->toBe([$order->id])
        ->and(CheckoutCatalog::availableKeys($offer))->toBe(19);
});
