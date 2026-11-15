<?php

namespace App\Services\Homepage;

use Illuminate\Contracts\Container\Container;

/** Block type (the `homepage_blocks.type` column) → provider class. Bound in AppServiceProvider. */
final class BlockProviderRegistry
{
    /** @param array<string, class-string<BlockProvider>> $providers */
    public function __construct(
        private readonly Container $container,
        private readonly array $providers,
    ) {}

    /** The provider for a block type, or null when the type is unknown. */
    public function get(string $type): ?BlockProvider
    {
        $class = $this->providers[$type] ?? null;

        // Resolved through the container, so a test can swap a provider with app()->instance().
        return $class === null ? null : $this->container->make($class);
    }
}
