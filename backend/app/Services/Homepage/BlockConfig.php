<?php

namespace App\Services\Homepage;

/**
 * Reads values from a block's `config` jsonb. The row is edited by hand in the database, so a missing
 * or mistyped value falls back to the default instead of failing the block.
 */
final class BlockConfig
{
    /** @param array<string, mixed> $config */
    public static function int(array $config, string $key, int $default, int $min, int $max): int
    {
        $value = $config[$key] ?? null;

        return is_int($value) ? max($min, min($max, $value)) : $default;
    }

    /**
     * A same-site path such as "/store?sort=bestselling", or null. Anything else (absolute and
     * protocol-relative URLs, "javascript:") is dropped, so a config row can't link off-site.
     *
     * @param  array<string, mixed>  $config
     */
    public static function path(array $config, string $key): ?string
    {
        $value = $config[$key] ?? null;

        if (! is_string($value) || ! str_starts_with($value, '/') || str_starts_with($value, '//') || str_contains($value, '\\')) {
            return null;
        }

        return $value;
    }
}
