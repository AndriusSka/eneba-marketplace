<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/** Hero banners and the homepage block layout. Order, titles and on/off state live here, not in the frontend. */
class HomepageSeeder extends Seeder
{
    public function run(): void
    {
        $catalog = require __DIR__.'/data/catalog.php';
        $now = now();

        DB::table('banners')->insert(array_map(
            fn (array $banner, int $i) => $banner + ['position' => $i + 1, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            $catalog['banners'],
            array_keys($catalog['banners']),
        ));

        DB::table('homepage_blocks')->insert(array_map(
            fn (array $block, int $i) => ['config' => json_encode($block['config'], JSON_THROW_ON_ERROR)] + $block
                + ['position' => $i + 1, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            $catalog['homepage_blocks'],
            array_keys($catalog['homepage_blocks']),
        ));
    }
}
