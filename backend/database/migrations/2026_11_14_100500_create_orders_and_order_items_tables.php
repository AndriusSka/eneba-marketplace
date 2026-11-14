<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained();
            $table->string('status');
            $table->integer('total_cents');
            $table->char('currency', 3)->default('EUR');
            $table->uuid('idempotency_key');
            $table->timestamp('paid_at')->nullable()->index(); // best-sellers time window
            $table->timestamps();

            $table->unique(['user_id', 'idempotency_key']);
            $table->index(['user_id', 'created_at']); // order history, newest first
        });

        DB::statement("ALTER TABLE orders ADD CONSTRAINT orders_status_valid CHECK (status IN ('paid'))");
        DB::statement('ALTER TABLE orders ADD CONSTRAINT orders_total_non_negative CHECK (total_cents >= 0)');
        DB::statement("ALTER TABLE orders ADD CONSTRAINT orders_currency_eur CHECK (currency = 'EUR')");

        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->index()->constrained();
            $table->foreignId('offer_id')->index()->constrained();
            $table->integer('unit_price_cents'); // copied at purchase time
            $table->integer('quantity');
            $table->timestamps();
        });

        DB::statement('ALTER TABLE order_items ADD CONSTRAINT order_items_quantity_range CHECK (quantity BETWEEN 1 AND 10)');
        DB::statement('ALTER TABLE order_items ADD CONSTRAINT order_items_price_positive CHECK (unit_price_cents > 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
    }
};
