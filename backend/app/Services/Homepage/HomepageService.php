<?php

namespace App\Services\Homepage;

use App\Models\HomepageBlock;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Builds GET /api/home from the `homepage_blocks` table (ARCHITECTURE.md › Homepage block design).
 * The order, titles and on/off state live in the database. A block whose type is unknown, whose
 * provider throws, or which has nothing to show is left out, and the rest of the page still renders.
 */
final class HomepageService
{
    public function __construct(private readonly BlockProviderRegistry $registry) {}

    /** @return list<array{id: int, type: string, title: string, link_url: string|null, data: list<array<string, mixed>>}> */
    public function blocks(): array
    {
        $blocks = HomepageBlock::query()
            ->where('is_active', true)
            ->orderBy('position')
            ->orderBy('id')
            ->get();

        $result = [];

        foreach ($blocks as $block) {
            $data = $this->fetch($block);

            if ($data === null || $data === []) {
                continue;
            }

            $result[] = [
                'id' => $block->id,
                'type' => $block->type,
                'title' => $block->title,
                'link_url' => BlockConfig::path($this->config($block), 'link_url'),
                'data' => $data,
            ];
        }

        return $result;
    }

    /** @return list<array<string, mixed>>|null null when the block can't be built */
    private function fetch(HomepageBlock $block): ?array
    {
        $context = ['block_id' => $block->id, 'type' => $block->type];

        // Building the provider is inside the try too: the container constructs it and its
        // dependencies, and a failure there must cost only this block, not the whole page.
        try {
            $provider = $this->registry->get($block->type);

            if ($provider === null) {
                Log::warning('Homepage block skipped: unknown type', $context);

                return null;
            }

            return $provider->fetch($this->config($block));
        } catch (Throwable $e) {
            Log::error('Homepage block skipped: provider failed', $context + ['exception' => $e]);

            return null;
        }
    }

    /**
     * The block's config as an object. The column is edited by hand, so a JSON array, string or
     * null counts as an empty config rather than a type error.
     *
     * @return array<string, mixed>
     */
    private function config(HomepageBlock $block): array
    {
        $config = $block->config;

        return is_array($config) && ! array_is_list($config) ? $config : [];
    }
}
