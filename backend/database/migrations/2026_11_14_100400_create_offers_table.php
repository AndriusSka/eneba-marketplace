<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('offers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained();
            $table->foreignId('seller_id')->index()->constrained();
            $table->integer('price_cents');
            $table->char('currency', 3)->default('EUR');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['product_id', 'seller_id']); // also serves lookups by product_id
        });

        DB::statement('ALTER TABLE offers ADD CONSTRAINT offers_price_positive CHECK (price_cents > 0)');
        DB::statement("ALTER TABLE offers ADD CONSTRAINT offers_currency_eur CHECK (currency = 'EUR')");
        // From-price per product, price sort and price filter only look at active offers.
        DB::statement('CREATE INDEX offers_active_product_price ON offers (product_id, price_cents) WHERE is_active');
    }

    public function down(): void
    {
        Schema::dropIfExists('offers');
    }
};
