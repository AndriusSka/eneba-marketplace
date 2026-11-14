<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('keys', function (Blueprint $table) {
            $table->id();
            $table->foreignId('offer_id')->index()->constrained();
            $table->string('code')->unique();
            $table->string('status')->default('available');
            $table->foreignId('order_item_id')->nullable()->index()->constrained();
            $table->timestamp('sold_at')->nullable();
            $table->timestamps();
        });

        DB::statement("ALTER TABLE keys ADD CONSTRAINT keys_status_valid CHECK (status IN ('available', 'sold'))");
        // A key is sold exactly when it is attached to an order line: no half-updated state.
        DB::statement("ALTER TABLE keys ADD CONSTRAINT keys_sold_has_order_item CHECK ((status = 'sold') = (order_item_id IS NOT NULL))");
        // Stock counts and the checkout claim (WHERE offer_id = ? AND status = 'available' ORDER BY id LIMIT n).
        DB::statement("CREATE INDEX keys_available_offer ON keys (offer_id, id) WHERE status = 'available'");
    }

    public function down(): void
    {
        Schema::dropIfExists('keys');
    }
};
