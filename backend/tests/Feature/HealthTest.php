<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

it('runs the test suite against PostgreSQL', function () {
    expect(DB::connection()->getDriverName())->toBe('pgsql');
});

it('reports ok when the database answers', function () {
    $this->getJson('/api/health')
        ->assertOk()
        ->assertExactJson(['status' => 'ok', 'db' => 'ok'])
        ->assertHeader('Cache-Control', 'no-store, private');
});

it('answers 503 without leaking details when the database is unreachable', function () {
    Log::spy();
    config([
        'database.connections.unreachable' => array_merge(config('database.connections.pgsql'), [
            'url' => null,
            'host' => '127.0.0.1',
            'port' => 1,
        ]),
        'database.default' => 'unreachable',
    ]);

    $this->getJson('/api/health')
        ->assertStatus(503)
        ->assertExactJson(['status' => 'error', 'db' => 'error']);

    Log::shouldHaveReceived('error')->once()->with('Health check: database unreachable', Mockery::type('array'));
});
