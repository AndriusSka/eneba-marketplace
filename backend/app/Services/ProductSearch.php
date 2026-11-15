<?php

namespace App\Services;

use Illuminate\Contracts\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * The name search shared by the Store listing (`/api/products?q=`) and the header autocomplete
 * (`/api/search/suggest`), so the two always agree. See ARCHITECTURE.md › Search approach.
 *
 * A title matches when it contains the query as a substring, or when pg_trgm's word similarity
 * (the query against the best-matching extent of the title) reaches the threshold: `q <% title`.
 * Both are served by the products_title_trgm GIN index on lower(title), so every expression here
 * uses lower(title) exactly.
 */
final class ProductSearch
{
    /**
     * Measured on the seeded catalog (ARCHITECTURE.md › Search approach):
     * - Real typos all score ≥ 0.40 (wticher 0.400, fiaf 0.400, sekrio 0.429, cyberpnk 0.667).
     * - Games we don't sell all score ≤ 0.333 (banana, fortnite, valorant 0.333; diablo 0.286).
     * 0.35 sits inside that gap rather than on a score that occurs. Trigram scores are ratios of
     * small counts (2/6, 2/5), so the threshold doesn't depend on > vs >= at the boundary.
     */
    public const WORD_SIMILARITY_THRESHOLD = 0.35;

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

    /**
     * Run search queries with the word-similarity threshold set.
     *
     * `<%` reads the threshold from the pg_trgm.word_similarity_threshold setting (default 0.6,
     * far too strict). set_config(…, true) scopes it to the transaction, so it never leaks to
     * other requests on a pooled connection.
     *
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    public function within(callable $callback): mixed
    {
        return DB::transaction(function () use ($callback) {
            DB::select("select set_config('pg_trgm.word_similarity_threshold', ?, true)", [
                (string) self::WORD_SIMILARITY_THRESHOLD,
            ]);

            return $callback();
        });
    }

    /**
     * Keep rows whose title contains the normalized query or is word-similar to it.
     * Call inside within(), or the fuzzy branch uses the strict default threshold.
     */
    public function filter(Builder $query, string $normalized): void
    {
        $query->whereRaw(
            "(lower(title) like ? escape '\\' or ? <% lower(title))",
            ['%'.self::escapeLike($normalized).'%', $normalized],
        );
    }

    /**
     * Order by match tier (0 exact, 1 title prefix "cyberp", 2 word prefix "ring", 3 other substring
     * or fuzzy), then by word similarity, so a closer typo beats a looser one.
     */
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
        $query->orderByRaw('word_similarity(?, lower(title)) desc', [$normalized]);
    }
}
