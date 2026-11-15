<?php

namespace App\Services\Homepage;

/**
 * One homepage block type (ARCHITECTURE.md › Homepage block design). Each provider reads only its own
 * data source. HomepageService catches anything it throws, so a broken provider costs only its block.
 */
interface BlockProvider
{
    /**
     * @param  array<string, mixed>  $config  the block row's `config` jsonb, untrusted: read it through BlockConfig
     * @return list<array<string, mixed>> the block's items; an empty list hides the block
     */
    public function fetch(array $config): array;
}
