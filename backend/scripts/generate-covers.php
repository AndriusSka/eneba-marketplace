<?php

/*
 * Generates one original SVG cover per catalog product into frontend/public/covers/{slug}.svg, and the
 * art for the catalog's hero banners at the image_url each banner already uses.
 *
 *   php scripts/generate-covers.php        (from backend/)
 *
 * The art is our own: a genre scene (no game's characters, logos or cover composition) drawn only in
 * the DESIGN.md palette, with the product title set on it. Slugs come from the same catalog file and
 * the same Str::slug() call as CatalogSeeder, so the file names always match products.cover_url.
 * Output is deterministic (seeded by the slug), so re-running only changes files when this script does.
 */

require __DIR__.'/../vendor/autoload.php';

use Illuminate\Support\Str;

const W = 300;
const H = 400;

// DESIGN.md › Colors, and nothing else.
const C = [
    'page' => '#4618AC', 'nav' => '#341282', 'surface' => '#311078', 'raised' => '#5825CC', 'card' => '#1F0A4D',
    'panel' => '#391787', 'inset' => '#2F0F74', 'field' => '#2B0E6A', 'filter' => '#461EA3', 'focus' => '#200B4E',
    'accent' => '#F9D316', 'accentHover' => '#FFE04D', 'teal' => '#05CDB0', 'fg' => '#FFFFFF', 'muted' => '#B2A2D1',
    'line' => '#4B1DB1', 'lineStrong' => '#A77EFE', 'discount' => '#74BD4A', 'mint' => '#5EEBC4', 'pink' => '#CA6493',
    'danger' => '#E5484D',
];

/** Palettes: sky gradient (top, bottom), far and near ground, a feature colour and its glow. */
const PALETTES = [
    'gold' => ['skyTop' => C['focus'], 'skyBottom' => C['raised'], 'far' => C['panel'], 'near' => C['card'], 'feature' => C['accent'], 'glow' => C['accentHover']],
    'teal' => ['skyTop' => C['card'], 'skyBottom' => C['filter'], 'far' => C['inset'], 'near' => C['focus'], 'feature' => C['teal'], 'glow' => C['mint']],
    'dusk' => ['skyTop' => C['nav'], 'skyBottom' => C['pink'], 'far' => C['page'], 'near' => C['card'], 'feature' => C['accent'], 'glow' => C['accentHover']],
    'ember' => ['skyTop' => C['focus'], 'skyBottom' => C['line'], 'far' => C['surface'], 'near' => C['card'], 'feature' => C['danger'], 'glow' => C['pink']],
    'meadow' => ['skyTop' => C['field'], 'skyBottom' => C['lineStrong'], 'far' => C['raised'], 'near' => C['inset'], 'feature' => C['discount'], 'glow' => C['mint']],
    'night' => ['skyTop' => C['card'], 'skyBottom' => C['nav'], 'far' => C['filter'], 'near' => C['focus'], 'feature' => C['lineStrong'], 'glow' => C['fg']],
];

/** Title → scene and the palettes it may use (the slug picks one, so platform versions differ). */
const ART = [
    'The Witcher 3: Wild Hunt' => ['mountains', ['night', 'teal']],
    'Cyberpunk 2077' => ['city', ['gold', 'ember']],
    'Elden Ring' => ['mountains', ['gold', 'dusk']],
    'Red Dead Redemption 2' => ['desert', ['dusk', 'ember']],
    'Minecraft' => ['blocks', ['meadow', 'teal']],
    "Baldur's Gate 3" => ['castle', ['ember', 'night']],
    'Hogwarts Legacy' => ['castle', ['gold']],
    'Grand Theft Auto V' => ['city', ['dusk']],
    'FIFA 23' => ['stadium', ['meadow']],
    'Stardew Valley' => ['farm', ['meadow']],
    'Hollow Knight' => ['cave', ['teal']],
    'The Legend of Zelda: Tears of the Kingdom' => ['mountains', ['meadow']],
    'Mario Kart 8 Deluxe' => ['track', ['gold']],
    'Forza Horizon 5' => ['track', ['dusk']],
    'Starfield' => ['space', ['night']],
    'God of War Ragnarök' => ['frost', ['teal']],
    "Ghost of Tsushima Director's Cut" => ['blossom', ['ember']],
    'Sekiro: Shadows Die Twice' => ['blossom', ['dusk']],
    'Hades' => ['flames', ['ember']],
];

$catalog = require __DIR__.'/../database/seeders/data/catalog.php';
$names = fn (string $key) => array_column($catalog[$key], 'name', 'slug');
$platformNames = $names('platforms');
$regionNames = $names('regions');

$outDir = __DIR__.'/../../frontend/public/covers';
if (! is_dir($outDir)) {
    mkdir($outDir, 0777, true);
}

$written = 0;
$editions = []; // title → how many editions so far, so a second platform edition gets the next palette
$cards = 0;
foreach ($catalog['products'] as $product) {
    // Must match CatalogSeeder exactly.
    $slug = Str::slug($product['title'].' '.$platformNames[$product['platform']].' '.$regionNames[$product['region']]);
    $isCard = ! isset(ART[$product['title']]);
    [$scene, $palettes] = $isCard ? ['card', ['gold', 'teal', 'dusk', 'meadow', 'night']] : ART[$product['title']];

    $edition = $isCard ? $cards++ : ($editions[$product['title']] = ($editions[$product['title']] ?? -1) + 1);
    mt_srand(crc32($slug));
    $palette = PALETTES[$palettes[$edition % count($palettes)]];

    file_put_contents("{$outDir}/{$slug}.svg", cover($product['title'], $scene, $palette, $platformNames[$product['platform']]));
    $written++;
}

echo "Wrote {$written} covers to frontend/public/covers/\n";

// Hero banners: written to the image_url each catalog banner already uses, so the database needs no change.
$bannerScenes = ['bannerPeaks', 'bannerCards', 'bannerDeals'];
foreach ($catalog['banners'] as $i => $banner) {
    mt_srand(1000 + $i);
    $scene = $bannerScenes[$i % count($bannerScenes)];
    file_put_contents(__DIR__.'/../../frontend/public'.$banner['image_url'], banner($banner['title'], $scene()));
    echo "Wrote banner {$banner['image_url']}\n";
}

// ─── Banners ───────────────────────────────────────────────────────────────────
// 800×400 (the tiles show at 2:1). HeroBanner lays the title on a dark band along the bottom, so the art
// keeps its focus in the upper right and leaves the lower left calm.

function banner(string $title, string $art): string
{
    $label = e($title).' banner art';

    return <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice" role="img" aria-label="{$label}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#200B4E"/><stop offset="1" stop-color="#5825CC"/></linearGradient>
    <radialGradient id="glow"><stop offset="0" stop-color="#FFE04D" stop-opacity="0.65"/><stop offset="1" stop-color="#FFE04D" stop-opacity="0"/></radialGradient>
    <radialGradient id="tealGlow"><stop offset="0" stop-color="#5EEBC4" stop-opacity="0.45"/><stop offset="1" stop-color="#5EEBC4" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="800" height="400" fill="url(#sky)"/>
{$art}
</svg>

SVG;
}

function wideRidge(int $y, int $amp, int $steps, string $fill, float $opacity = 1.0): string
{
    $points = ['0,400'];
    for ($i = 0; $i <= $steps; $i++) {
        $points[] = round($i * 800 / $steps).','.($y + ($i % 2 === 0 ? r(0, (int) ($amp / 3)) : -r((int) ($amp / 2), $amp)));
    }
    $points[] = '800,400';

    return '  <polygon points="'.implode(' ', $points)."\" fill=\"{$fill}\" opacity=\"{$opacity}\"/>";
}

function wideStars(int $count, int $maxY): string
{
    $out = [];
    for ($i = 0; $i < $count; $i++) {
        $out[] = sprintf('  <circle cx="%d" cy="%d" r="%.1f" fill="#FFFFFF" opacity="%.2f"/>', r(10, 790), r(10, $maxY), r(6, 18) / 10, r(35, 90) / 100);
    }

    return implode("\n", $out);
}

/** Moonlit peaks with a lone tower: the fantasy banner. */
function bannerPeaks(): string
{
    return implode("\n", [
        wideStars(70, 230),
        '  <circle cx="610" cy="110" r="120" fill="url(#glow)"/>',
        '  <circle cx="610" cy="110" r="52" fill="'.C['accent'].'"/>',
        '  <circle cx="592" cy="96" r="9" fill="'.C['accentHover'].'" opacity="0.7"/><circle cx="628" cy="128" r="6" fill="'.C['accentHover'].'" opacity="0.6"/>',
        wideRidge(230, 110, 8, C['panel'], 0.9),
        wideRidge(285, 90, 12, C['raised'], 0.55),
        // The tower on the near ridge, its window lit.
        '  <path d="M520 300 h30 v-96 l-15 -26 l-15 26 z" fill="'.C['card'].'"/><rect x="531" y="222" width="8" height="12" fill="'.C['accent'].'"/>',
        wideRidge(330, 50, 10, C['card']),
        // A path of light from the tower down the slope.
        '  <path d="M535 300 C500 330 470 350 420 400 L460 400 C500 360 520 335 545 300 z" fill="'.C['accent'].'" opacity="0.18"/>',
    ]);
}

/** A fan of gift cards, one per platform: the gift card banner. */
function bannerCards(): string
{
    $pattern = '';
    for ($i = -400; $i < 800; $i += 36) {
        $pattern .= sprintf('  <line x1="%d" y1="0" x2="%d" y2="400" stroke="%s" stroke-opacity="0.08" stroke-width="12"/>', $i, $i + 400, C['lineStrong'])."\n";
    }
    // Each card is 180 wide and the next one starts 125 to the right, so the brand and value (on the
    // left of each card) stay visible under the overlap. All of it sits above the title band.
    $cards = '';
    foreach ([['NINTENDO', '25 EUR', C['danger'], -9], ['XBOX', '25 USD', C['discount'], -3], ['PLAYSTATION', '25 EUR', C['teal'], 3], ['STEAM', '50 EUR', C['accent'], 9]] as $i => [$brand, $value, $edge, $angle]) {
        $x = 215 + $i * 125;
        $y = 46 + abs($i - 1.5) * 10;
        $cards .= sprintf(
            '  <g transform="rotate(%d %d %d)"><rect x="%d" y="%d" width="180" height="120" rx="10" fill="%s"/><rect x="%d" y="%d" width="180" height="120" rx="10" fill="none" stroke="%s" stroke-width="3"/><rect x="%d" y="%d" width="28" height="21" rx="4" fill="%s"/><text x="%d" y="%d" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="12" fill="%s">%s</text><text x="%d" y="%d" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="28" fill="%s">%s</text></g>',
            $angle, $x + 90, $y + 60,
            $x, $y, C['panel'],
            $x, $y, $edge,
            $x + 14, $y + 14, C['accent'],
            $x + 14, $y + 58, C['muted'], $brand,
            $x + 14, $y + 98, C['fg'], $value,
        )."\n";
    }
    $sparkles = '';
    foreach ([[170, 60, 1.0], [770, 230, 0.8], [700, 330, 0.7], [190, 210, 0.6]] as [$x, $y, $s]) {
        $sparkles .= sprintf('  <path d="M0 -14 L4 -4 L14 0 L4 4 L0 14 L-4 4 L-14 0 L-4 -4 Z" fill="%s" transform="translate(%d %d) scale(%.1f)"/>', C['accentHover'], $x, $y, $s)."\n";
    }

    return implode("\n", [
        rtrim($pattern),
        '  <circle cx="620" cy="170" r="220" fill="url(#tealGlow)"/>',
        rtrim($cards),
        rtrim($sparkles),
    ]);
}

/** Price tags with discounts over a falling price line: the low prices banner. */
function bannerDeals(): string
{
    $bars = '';
    foreach ([300, 250, 215, 170, 140, 105] as $i => $h) {
        $bars .= sprintf('  <rect x="%d" y="%d" width="38" height="%d" rx="3" fill="%s" opacity="0.35"/>', 380 + $i * 64, 340 - $h, $h + 60, C['lineStrong'])."\n";
    }
    $tags = '';
    foreach ([['-27%', 520, 70, -12], ['-40%', 650, 140, 8], ['-45%', 455, 190, -4]] as [$text, $x, $y, $angle]) {
        $tags .= sprintf(
            '  <g transform="rotate(%d %d %d)"><path d="M%d %d h118 a8 8 0 0 1 8 8 v52 a8 8 0 0 1 -8 8 h-118 l-26 -34 z" fill="%s"/><circle cx="%d" cy="%d" r="6" fill="%s"/><text x="%d" y="%d" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="34" fill="%s">%s</text></g>',
            $angle, $x, $y, $x, $y - 34, C['discount'], $x + 6, $y, C['card'], $x + 22, $y + 12, C['card'], $text,
        )."\n";
    }

    return implode("\n", [
        wideStars(30, 200),
        rtrim($bars),
        // The price line, falling left to right, with an arrow head.
        '  <polyline points="380,90 444,140 508,125 572,190 636,215 700,262 760,300" fill="none" stroke="'.C['accent'].'" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>',
        '  <polygon points="772,312 744,306 762,286" fill="'.C['accent'].'"/>',
        rtrim($tags),
    ]);
}

// ─── Cover assembly ────────────────────────────────────────────────────────────

function cover(string $title, string $scene, array $p, string $platform): string
{
    $art = match ($scene) {
        'mountains' => mountains($p),
        'castle' => castle($p),
        'city' => city($p),
        'desert' => desert($p),
        'blocks' => blocks($p),
        'farm' => farm($p),
        'cave' => cave($p),
        'track' => track($p),
        'space' => space($p),
        'frost' => frost($p),
        'blossom' => blossom($p),
        'flames' => flames($p),
        'stadium' => stadium($p),
        'card' => giftCard($p, $title, $platform),
    };

    $label = e($title).' cover art';
    $titleBlock = titleBlock($title, $scene === 'card');

    return <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" role="img" aria-label="{$label}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{$p['skyTop']}"/><stop offset="1" stop-color="{$p['skyBottom']}"/></linearGradient>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0.5" stop-color="{$p['near']}" stop-opacity="0"/><stop offset="1" stop-color="{$p['near']}" stop-opacity="0.92"/></linearGradient>
    <radialGradient id="glow"><stop offset="0" stop-color="{$p['glow']}" stop-opacity="0.7"/><stop offset="1" stop-color="{$p['glow']}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="300" height="400" fill="url(#sky)"/>
{$art}
  <rect width="300" height="400" fill="url(#shade)"/>
{$titleBlock}
  <rect x="8" y="8" width="284" height="384" rx="2" fill="none" stroke="#A77EFE" stroke-opacity="0.35"/>
</svg>

SVG;
}

/** The title in upper case, wrapped to at most 3 lines and sized to fit, above the card's platform band. */
function titleBlock(string $title, bool $small): string
{
    $words = preg_split('/\s+/u', mb_strtoupper($title));
    $sizes = $small ? [20, 18, 16] : [34, 30, 27, 24, 21, 19, 17];
    foreach ($sizes as $size) {
        $maxChars = (int) floor(256 / ($size * 0.7));
        $lines = [];
        $line = '';
        foreach ($words as $word) {
            $try = $line === '' ? $word : "{$line} {$word}";
            if (mb_strlen($try) <= $maxChars) {
                $line = $try;
            } else {
                $lines[] = $line;
                $line = $word;
            }
        }
        $lines[] = $line;
        $lines = array_values(array_filter($lines, fn ($l) => $l !== ''));
        if (count($lines) <= 3 && max(array_map('mb_strlen', $words)) <= $maxChars) {
            break;
        }
    }

    $lineHeight = round($size * 1.08, 1);
    $baseline = 334 - (count($lines) - 1) * $lineHeight;
    $out = '';
    foreach ($lines as $i => $text) {
        $y = round($baseline + $i * $lineHeight, 1);
        $out .= "  <text x=\"22\" y=\"{$y}\" font-family=\"Arial, Helvetica, sans-serif\" font-weight=\"700\" font-size=\"{$size}\" letter-spacing=\"0.5\" fill=\"#FFFFFF\">".e($text)."</text>\n";
    }

    return rtrim($out, "\n");
}

function e(string $text): string
{
    return htmlspecialchars($text, ENT_XML1 | ENT_QUOTES, 'UTF-8');
}

function r(int $min, int $max): int
{
    return mt_rand($min, $max);
}

/** A jagged ridge from x=0 to x=300 around `$y`, closed to the bottom. */
function ridge(int $y, int $amp, int $steps, string $fill, float $opacity = 1.0): string
{
    $points = ['0,'.H];
    for ($i = 0; $i <= $steps; $i++) {
        $x = round($i * W / $steps);
        $points[] = $x.','.($y + ($i % 2 === 0 ? r(0, (int) ($amp / 3)) : -r((int) ($amp / 2), $amp)));
    }
    $points[] = W.','.H;

    return '  <polygon points="'.implode(' ', $points)."\" fill=\"{$fill}\" opacity=\"{$opacity}\"/>";
}

function stars(int $count, int $maxY, string $fill = '#FFFFFF'): string
{
    $out = [];
    for ($i = 0; $i < $count; $i++) {
        $out[] = sprintf('  <circle cx="%d" cy="%d" r="%.1f" fill="%s" opacity="%.2f"/>', r(10, 290), r(10, $maxY), r(5, 16) / 10, $fill, r(35, 90) / 100);
    }

    return implode("\n", $out);
}

function orb(int $cx, int $cy, int $r, string $fill): string
{
    $g = $r * 2;

    return "  <circle cx=\"{$cx}\" cy=\"{$cy}\" r=\"{$g}\" fill=\"url(#glow)\"/>\n  <circle cx=\"{$cx}\" cy=\"{$cy}\" r=\"{$r}\" fill=\"{$fill}\"/>";
}

// ─── Scenes ────────────────────────────────────────────────────────────────────

function mountains(array $p): string
{
    return implode("\n", [
        stars(26, 140),
        orb(r(70, 230), r(70, 110), r(24, 34), $p['glow']),
        ridge(190, 70, 6, $p['far'], 0.85),
        ridge(235, 60, 9, C['raised'], 0.55),
        ridge(275, 40, 7, $p['near']),
        // A lone watchtower on the middle ridge.
        sprintf('  <path d="M%1$d 230 h14 v-46 l-7 -12 l-7 12 z" fill="%2$s"/><rect x="%3$d" y="196" width="4" height="6" fill="%4$s"/>', $x = r(60, 220), $p['near'], $x + 5, $p['feature']),
    ]);
}

function castle(array $p): string
{
    $towers = '';
    foreach ([[70, 150, 22], [110, 120, 26], [150, 90, 30], [194, 125, 24], [232, 160, 20]] as [$x, $top, $w]) {
        $towers .= sprintf('  <rect x="%d" y="%d" width="%d" height="%d" fill="%s"/>', $x - $w / 2, $top, $w, 260 - $top, $p['near'])."\n";
        $towers .= sprintf('  <polygon points="%d,%d %d,%d %d,%d" fill="%s"/>', $x - $w / 2 - 4, $top, $x, $top - $w * 1.3, $x + $w / 2 + 4, $top, $p['near'])."\n";
        $towers .= sprintf('  <rect x="%d" y="%d" width="5" height="9" rx="2" fill="%s"/>', $x - 2, $top + 18, $p['feature'])."\n";
    }

    return implode("\n", [
        stars(30, 160),
        orb(r(200, 250), 70, 22, $p['glow']),
        ridge(250, 30, 5, $p['far'], 0.9),
        rtrim($towers),
        '  <rect x="56" y="200" width="190" height="70" fill="'.$p['near'].'"/>',
        '  <path d="M138 270 v-26 a13 13 0 0 1 26 0 v26 z" fill="'.$p['feature'].'" opacity="0.85"/>',
        ridge(285, 20, 6, $p['near']),
    ]);
}

function city(array $p): string
{
    $sunY = 175;
    $sun = orb(150, $sunY, 62, $p['feature']);
    // Horizontal cuts through the lower half of the sun.
    for ($i = 0; $i < 5; $i++) {
        $sun .= sprintf("\n  <rect x=\"80\" y=\"%d\" width=\"140\" height=\"%d\" fill=\"%s\"/>", $sunY + 8 + $i * 11, 2 + $i, $p['skyBottom']);
    }
    $buildings = '';
    $x = 0;
    while ($x < W) {
        $w = r(22, 42);
        $h = r(70, 190);
        $buildings .= sprintf('  <rect x="%d" y="%d" width="%d" height="%d" fill="%s"/>', $x, 280 - $h, $w - 3, $h + 120, $p['near'])."\n";
        for ($wy = 290 - $h; $wy < 270; $wy += 12) {
            for ($wx = $x + 4; $wx < $x + $w - 8; $wx += 8) {
                if (r(0, 9) < 3) {
                    $buildings .= sprintf('  <rect x="%d" y="%d" width="3" height="5" fill="%s" opacity="0.85"/>', $wx, $wy, r(0, 3) === 0 ? C['teal'] : $p['glow'])."\n";
                }
            }
        }
        $x += $w;
    }

    return implode("\n", [
        stars(18, 110),
        $sun,
        rtrim($buildings),
        '  <rect x="0" y="279" width="300" height="2" fill="'.C['teal'].'" opacity="0.8"/>',
    ]);
}

function desert(array $p): string
{
    $sun = orb(r(100, 200), 150, 46, $p['feature']);
    $cacti = '';
    foreach ([r(30, 80), r(200, 260)] as $x) {
        $cacti .= sprintf('  <path d="M%1$d 300 v-56 a6 6 0 0 1 12 0 v56 z M%1$d 272 h-10 v-16 a4 4 0 0 1 8 0 v8 h2 z M%2$d 262 h10 v-14 a4 4 0 0 0 -8 0 v6 h-2 z" fill="%3$s"/>', $x, $x + 12, $p['near'])."\n";
    }

    return implode("\n", [
        $sun,
        '  <polygon points="0,240 30,240 42,200 98,200 110,240 300,240 300,400 0,400" fill="'.$p['far'].'" opacity="0.9"/>',
        '  <polygon points="150,250 170,210 230,210 252,250" fill="'.$p['far'].'"/>',
        ridge(275, 14, 4, $p['near']),
        rtrim($cacti),
    ]);
}

function blocks(array $p): string
{
    $out = [orb(r(190, 240), 70, 20, $p['glow'])];
    $out[] = '  <rect x="'.r(40, 80).'" y="60" width="44" height="14" fill="'.C['fg'].'" opacity="0.5"/>';
    $size = 25;
    $height = 7;
    for ($col = 0; $col < 12; $col++) {
        $height = max(4, min(10, $height + r(-1, 1)));
        $top = H - $height * $size - 60;
        $out[] = sprintf('  <rect x="%d" y="%d" width="%d" height="%d" fill="%s"/>', $col * $size, $top, $size, $size, $p['feature']);
        $out[] = sprintf('  <rect x="%d" y="%d" width="%d" height="%d" fill="%s"/>', $col * $size, $top + $size, $size, H - $top, $p['far']);
        for ($row = $top + $size; $row < H; $row += $size) {
            $out[] = sprintf('  <rect x="%d" y="%d" width="%d" height="%d" fill="none" stroke="%s" stroke-opacity="0.35"/>', $col * $size, $row, $size, $size, $p['far']);
        }
        $out[] = sprintf('  <rect x="%d" y="%d" width="%d" height="5" fill="%s" opacity="0.6"/>', $col * $size, $top, $size, $p['glow']);
    }

    return implode("\n", $out);
}

function farm(array $p): string
{
    $rows = '';
    for ($i = 0; $i < 7; $i++) {
        $rows .= sprintf('  <path d="M%d 400 L150 255" stroke="%s" stroke-width="3" opacity="0.5"/>', -60 + $i * 70, $p['feature'])."\n";
    }

    return implode("\n", [
        orb(80, 90, 30, C['accent']),
        '  <ellipse cx="80" cy="270" rx="200" ry="70" fill="'.$p['far'].'"/>',
        '  <ellipse cx="260" cy="280" rx="160" ry="60" fill="'.$p['far'].'" opacity="0.8"/>',
        '  <path d="M196 236 v-34 l22 -18 l22 18 v34 z" fill="'.C['danger'].'"/><rect x="211" y="214" width="14" height="22" fill="'.$p['near'].'"/>',
        '  <rect x="0" y="255" width="300" height="145" fill="'.$p['near'].'"/>',
        rtrim($rows),
    ]);
}

function cave(array $p): string
{
    $drips = '';
    for ($x = 0; $x < W; $x += r(18, 34)) {
        $drips .= sprintf('  <polygon points="%d,0 %d,%d %d,0" fill="%s"/>', $x, $x + 8, r(30, 90), $x + 16, $p['near'])."\n";
    }
    $crystals = '';
    for ($i = 0; $i < 6; $i++) {
        $x = r(30, 270);
        $h = r(18, 40);
        $crystals .= sprintf('  <polygon points="%d,280 %d,%d %d,280" fill="%s" opacity="0.85"/>', $x - 6, $x, 280 - $h, $x + 6, $i % 2 ? $p['feature'] : $p['glow'])."\n";
    }

    return implode("\n", [
        '  <path d="M0 400 V140 Q150 20 300 140 V400 Z" fill="'.$p['far'].'"/>',
        '  <path d="M40 400 V190 Q150 90 260 190 V400 Z" fill="'.$p['near'].'"/>',
        orb(150, 210, 6, $p['glow']),
        '  <ellipse cx="136" cy="214" rx="5" ry="7" fill="'.C['fg'].'"/><ellipse cx="164" cy="214" rx="5" ry="7" fill="'.C['fg'].'"/>',
        rtrim($drips),
        rtrim($crystals),
    ]);
}

function track(array $p): string
{
    $dashes = '';
    for ($i = 0; $i < 6; $i++) {
        $y = 205 + $i * $i * 6 + $i * 10;
        $dashes .= sprintf('  <rect x="%d" y="%d" width="%d" height="%d" fill="%s"/>', 150 - (1 + $i), $y, 2 + 2 * $i, 6 + 3 * $i, C['fg'])."\n";
    }
    $lines = '';
    for ($i = 0; $i < 6; $i++) {
        $y = r(60, 180);
        $lines .= sprintf('  <rect x="%d" y="%d" width="%d" height="2" fill="%s" opacity="0.5"/>', r(0, 200), $y, r(40, 100), C['fg'])."\n";
    }

    return implode("\n", [
        orb(r(90, 210), 140, 30, $p['feature']),
        rtrim($lines),
        ridge(200, 30, 6, $p['far']),
        '  <polygon points="140,200 160,200 300,400 0,400" fill="'.$p['near'].'"/>',
        '  <polygon points="140,200 146,200 10,400 0,400 0,380" fill="'.C['danger'].'" opacity="0.8"/>',
        '  <polygon points="154,200 160,200 300,380 300,400 290,400" fill="'.C['fg'].'" opacity="0.6"/>',
        rtrim($dashes),
    ]);
}

function space(array $p): string
{
    return implode("\n", [
        stars(70, 380),
        '  <circle cx="190" cy="170" r="70" fill="'.$p['far'].'"/>',
        '  <path d="M120 170 a70 70 0 0 0 140 0" fill="'.$p['near'].'" opacity="0.6"/>',
        '  <ellipse cx="190" cy="170" rx="120" ry="22" fill="none" stroke="'.$p['feature'].'" stroke-width="5" transform="rotate(-14 190 170)"/>',
        orb(70, 90, 12, C['accent']),
        '  <path d="M40 300 l26 -10 l8 -26 l8 26 l26 10 l-26 10 l-8 26 l-8 -26 z" fill="'.C['fg'].'" opacity="0.8" transform="scale(0.5) translate(40 300)"/>',
    ]);
}

function frost(array $p): string
{
    $aurora = '';
    foreach ([[80, 0.35], [110, 0.25], [140, 0.18]] as [$y, $o]) {
        $aurora .= sprintf('  <path d="M0 %1$d C80 %2$d 160 %3$d 300 %4$d" stroke="%5$s" stroke-width="18" fill="none" opacity="%6$s"/>', $y, $y - 40, $y + 40, $y - 20, $p['glow'], $o)."\n";
    }

    return implode("\n", [
        stars(30, 200),
        rtrim($aurora),
        '  <polygon points="0,260 70,150 110,200 160,110 220,210 260,170 300,230 300,400 0,400" fill="'.$p['far'].'"/>',
        '  <polygon points="160,110 178,140 166,134 152,144 144,132" fill="'.C['fg'].'"/>',
        '  <polygon points="70,150 82,170 70,165 58,172" fill="'.C['fg'].'"/>',
        '  <polygon points="260,170 272,186 258,182 250,188" fill="'.C['fg'].'"/>',
        ridge(285, 25, 8, $p['near']),
    ]);
}

function blossom(array $p): string
{
    $petals = '';
    for ($i = 0; $i < 22; $i++) {
        $petals .= sprintf('  <ellipse cx="%d" cy="%d" rx="4" ry="2.5" fill="%s" opacity="%.2f" transform="rotate(%d %d %d)"/>', $x = r(20, 290), $y = r(20, 300), C['pink'], r(55, 95) / 100, r(0, 180), $x, $y)."\n";
    }

    return implode("\n", [
        orb(170, 160, 72, $p['feature']),
        ridge(250, 40, 5, $p['far'], 0.9),
        '  <path d="M300 40 C230 60 200 90 150 92 M230 62 C220 40 200 30 180 34 M200 84 C190 110 170 120 150 124" stroke="'.$p['near'].'" stroke-width="7" fill="none" stroke-linecap="round"/>',
        rtrim($petals),
        ridge(290, 18, 6, $p['near']),
    ]);
}

function flames(array $p): string
{
    $tongues = '';
    for ($x = -10; $x < W; $x += 36) {
        $h = r(90, 170);
        $tongues .= sprintf('  <path d="M%1$d 330 Q%2$d %3$d %4$d %5$d Q%6$d %7$d %8$d 330 Z" fill="%9$s" opacity="0.9"/>', $x, $x + 4, 330 - $h / 2, $x + 18, 330 - $h, $x + 34, 330 - $h / 2, $x + 36, $p['feature'])."\n";
        $tongues .= sprintf('  <path d="M%1$d 330 Q%2$d %3$d %4$d %5$d Q%6$d %7$d %8$d 330 Z" fill="%9$s"/>', $x + 8, $x + 10, 330 - $h / 4, $x + 18, 330 - $h / 2, $x + 28, 330 - $h / 4, $x + 28, C['accent'])."\n";
    }
    $embers = '';
    for ($i = 0; $i < 24; $i++) {
        $embers .= sprintf('  <circle cx="%d" cy="%d" r="%.1f" fill="%s" opacity="0.8"/>', r(10, 290), r(30, 200), r(8, 22) / 10, $i % 3 ? C['accent'] : $p['glow'])."\n";
    }

    return implode("\n", [
        '  <rect x="40" y="70" width="24" height="260" fill="'.$p['near'].'"/><rect x="236" y="70" width="24" height="260" fill="'.$p['near'].'"/>',
        '  <path d="M30 80 Q150 10 270 80 v14 Q150 30 30 94 z" fill="'.$p['near'].'"/>',
        rtrim($embers),
        rtrim($tongues),
    ]);
}

function stadium(array $p): string
{
    $beams = '';
    foreach ([[30, 20], [270, 20]] as [$x, $y]) {
        $beams .= sprintf('  <polygon points="%d,%d %d,230 %d,230" fill="%s" opacity="0.18"/>', $x, $y, $x < 150 ? 60 : 160, $x < 150 ? 140 : 240, C['fg'])."\n";
        $beams .= sprintf('  <rect x="%d" y="%d" width="20" height="10" fill="%s"/>', $x - 10, $y - 5, C['fg'])."\n";
    }

    return implode("\n", [
        stars(14, 120),
        rtrim($beams),
        '  <rect x="0" y="150" width="300" height="70" fill="'.$p['near'].'"/>',
        '  <polygon points="40,220 260,220 300,400 0,400" fill="'.$p['feature'].'" opacity="0.85"/>',
        '  <polygon points="40,220 260,220 300,400 0,400" fill="none" stroke="'.C['fg'].'" stroke-width="2"/>',
        '  <line x1="150" y1="220" x2="150" y2="400" stroke="'.C['fg'].'" stroke-width="2"/>',
        '  <ellipse cx="150" cy="290" rx="44" ry="18" fill="none" stroke="'.C['fg'].'" stroke-width="2"/>',
        '  <circle cx="190" cy="262" r="9" fill="'.C['fg'].'"/>',
    ]);
}

/** A gift card on a patterned background: the value is the hero, the brand is small. */
function giftCard(array $p, string $title, string $platform): string
{
    preg_match('/(\d+)\s*(EUR|USD)|(\d+)\s*Months/i', $title, $m);
    $value = isset($m[1]) && $m[1] !== '' ? $m[1].' '.strtoupper($m[2]) : (isset($m[3]) ? $m[3].' MONTHS' : '');
    $pattern = '';
    for ($i = -400; $i < 400; $i += 24) {
        $pattern .= sprintf('  <line x1="%d" y1="0" x2="%d" y2="400" stroke="%s" stroke-opacity="0.12" stroke-width="8"/>', $i, $i + 400, $p['glow'])."\n";
    }

    return implode("\n", [
        rtrim($pattern),
        '  <g transform="rotate(-8 150 160)">',
        '    <rect x="40" y="90" width="220" height="140" rx="12" fill="'.$p['far'].'"/>',
        '    <rect x="40" y="90" width="220" height="140" rx="12" fill="none" stroke="'.$p['feature'].'" stroke-width="3"/>',
        '    <rect x="58" y="112" width="34" height="26" rx="4" fill="'.C['accent'].'"/>',
        '    <text x="242" y="130" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="14" fill="'.C['muted'].'">'.e(mb_strtoupper($platform)).'</text>',
        '    <text x="58" y="200" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="38" fill="'.C['fg'].'">'.e($value).'</text>',
        '  </g>',
    ]);
}
