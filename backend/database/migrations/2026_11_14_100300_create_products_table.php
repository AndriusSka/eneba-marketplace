<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('title');
            $table->foreignId('platform_id')->index()->constrained();
            $table->foreignId('region_id')->index()->constrained();
            $table->text('description');
            $table->string('cover_url');
            $table->date('release_date')->nullable()->index(); // null for gift cards; "newest" sort
            $table->integer('msrp_cents');
            $table->char('currency', 3)->default('EUR');
            $table->timestamps();
        });

        DB::statement('ALTER TABLE products ADD CONSTRAINT products_msrp_positive CHECK (msrp_cents > 0)');
        DB::statement("ALTER TABLE products ADD CONSTRAINT products_currency_eur CHECK (currency = 'EUR')");
        // One GIN index serves the LIKE prefix patterns and the <% word-similarity operator.
        // Queries must use lower(title) exactly for it to apply.
        DB::statement('CREATE INDEX products_title_trgm ON products USING gin (lower(title) gin_trgm_ops)');
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
