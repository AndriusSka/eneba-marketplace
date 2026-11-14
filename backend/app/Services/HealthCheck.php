<?php

namespace App\Services;

use Illuminate\Database\DatabaseManager;
use Illuminate\Support\Facades\Log;
use Throwable;

final class HealthCheck
{
    public function __construct(private readonly DatabaseManager $db) {}

    /**
     * Liveness plus a database round trip.
     *
     * @return array{status: 'ok'|'error', db: 'ok'|'error'}
     */
    public function run(): array
    {
        try {
            $this->db->connection()->select('select 1');
        } catch (Throwable $e) {
            Log::error('Health check: database unreachable', ['exception' => $e]);

            return ['status' => 'error', 'db' => 'error'];
        }

        return ['status' => 'ok', 'db' => 'ok'];
    }
}
