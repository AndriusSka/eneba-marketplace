<?php

namespace App\Services;

use Illuminate\Contracts\Database\Query\Builder;

/**
 * The name filter shared by the Store listing and (from M3) the header autocomplete.
 *
 * M2 matches a substring of lower(title), served by the products_title_trgm GIN index, and ranks
 * by tier: exact, title prefix, word prefix, other substring. M3 adds the fuzzy word-similarity
 * branch (pg_trgm `<%`) and its threshold. See ARCHITECTURE.md › Search approach.
 *
 * Expressions use lower(title) exactly, so the expression index applies.
 */
final class ProductSearch
{
    /** Trim, lower-case and collapse whitespace. An empty result means "no search". */
    public static function normalize(?string $query): string
    {
        $query = mb_strtolower(trim((string) $query));

        return preg_replace('/\s+/u', ' ', $query) ?? '';
    }

    /** Escape LIKE wildcards so "%" and "_" in a query match literally. */
    public static function escapeLike(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
    }

    /** Keep rows whose title contains the normalized query. */
    public function filter(Builder $query, string $normalized): void
    {
        $query->whereRaw("lower(title) like ? escape '\\'", ['%'.self::escapeLike($normalized).'%']);
    }

    /** Order by match tier: 0 exact, 1 title prefix ("cyberp"), 2 word prefix ("ring"), 3 other. */
    public function orderByRelevance(Builder $query, string $normalized): void
    {
        $like = self::escapeLike($normalized);

        $query->orderByRaw(
            "case when lower(title) = ? then 0
                  when lower(title) like ? escape '\\' then 1
                  when lower(title) like ? escape '\\' then 2
                  else 3 end",
            [$normalized, $like.'%', '% '.$like.'%'],
        );
    }
}
