<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('banners', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('subtitle')->nullable();
            $table->string('image_url');
            $table->string('link_url');
            $table->integer('position');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        DB::statement('CREATE INDEX banners_active_position ON banners (position) WHERE is_active');

        Schema::create('homepage_blocks', function (Blueprint $table) {
            $table->id();
            $table->string('type'); // provider key, e.g. "best_sellers"
            $table->string('title');
            $table->integer('position');
            $table->boolean('is_active')->default(true);
            $table->jsonb('config')->default('{}');
            $table->timestamps();
        });

        DB::statement('CREATE INDEX homepage_blocks_active_position ON homepage_blocks (position) WHERE is_active');
    }

    public function down(): void
    {
        Schema::dropIfExists('homepage_blocks');
        Schema::dropIfExists('banners');
    }
};
