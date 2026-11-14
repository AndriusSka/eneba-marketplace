<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use RuntimeException;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        // Without .env.testing Laravel falls back to .env, and RefreshDatabase would wipe the dev database.
        // CI provides its database through environment variables instead.
        if (! is_file(dirname(__DIR__).'/.env.testing') && getenv('CI') === false) {
            throw new RuntimeException('Missing backend/.env.testing. Copy .env.testing.example and point DB_URL at the Neon test branch.');
        }

        parent::setUp();
    }
}
