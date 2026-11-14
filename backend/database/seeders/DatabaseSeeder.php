<?php

namespace Database\Seeders;

use App\Models\Product;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Idempotent demo data. Production runs this on every container start (`migrate --force --seed`),
 * so it must do nothing once the catalog exists, and it must not use Faker (a dev-only package).
 */
class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /** Fixed seed so dev, test and production get the same catalog, prices and stock. */
    public const RANDOM_SEED = 20261114;

    public function run(): void
    {
        if (Product::query()->exists()) {
            $this->command?->info('Demo data already present, skipping seed.');

            return;
        }

        mt_srand(self::RANDOM_SEED);

        // All or nothing: a seed interrupted halfway must not leave a partial catalog that the guard above would then keep forever.
        DB::transaction(function () {
            $this->call([
                CatalogSeeder::class,
                OrderHistorySeeder::class,
                HomepageSeeder::class,
            ]);
        });

        $this->command?->info('Demo data seeded.');
    }
}
