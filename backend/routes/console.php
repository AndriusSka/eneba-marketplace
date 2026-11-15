<?php

use App\Models\User;
use App\Services\Checkout\CheckoutException;
use App\Services\Checkout\CheckoutService;
use App\Services\Checkout\TestCards;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// One buyer for the checkout concurrency test (tests/Feature/CheckoutConcurrencyTest.php), which
// starts many of these as separate OS processes so each has its own database connection. It only
// exists outside production: it creates paid orders without a request.
if (! app()->isProduction()) {
    Artisan::command(
        'checkout:simulate {user : user id} {offer : offer id} {--qty=1} {--key= : Idempotency-Key, random if empty} {--start-at= : unix time in ms to wait for, so all workers fire together}',
        function (CheckoutService $checkout) {
            $user = User::findOrFail((int) $this->argument('user'));

            // Connect before the barrier, so connection set-up time doesn't stagger the workers.
            DB::select('select 1');

            $startAt = (int) $this->option('start-at');
            $waitMs = $startAt - (int) floor(microtime(true) * 1000);
            if ($waitMs > 0) {
                usleep($waitMs * 1000);
            }

            $items = [['offer_id' => (int) $this->argument('offer'), 'quantity' => (int) $this->option('qty')]];
            $key = (string) ($this->option('key') ?: Str::uuid());

            try {
                $result = $checkout->checkout($user, $items, TestCards::APPROVED, $key);
                $outcome = [
                    'result' => $result->replayed ? 'replayed' : 'created',
                    'order_id' => $result->order->id,
                ];
            } catch (CheckoutException $e) {
                $outcome = ['result' => $e->errorCode, 'order_id' => null];
            }

            $this->line((string) json_encode($outcome));
        },
    )->purpose('Run one checkout as a user (concurrency test helper; not registered in production)');
}
