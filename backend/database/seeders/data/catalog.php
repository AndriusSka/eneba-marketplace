<?php

/*
 * Fixed demo catalog. Titles, release dates and MSRPs are real; descriptions are our own.
 * No game art: each product's cover is our own SVG in frontend/public/covers/{slug}.svg, made by
 * scripts/generate-covers.php (re-run it after adding or renaming a product).
 *
 * Product flags:
 *   out_of_stock  every offer gets 0 keys
 *   gift_card     priced near face value and has no release date
 */

return [
    'platforms' => [
        ['slug' => 'steam', 'name' => 'Steam'],
        ['slug' => 'xbox', 'name' => 'Xbox'],
        ['slug' => 'playstation', 'name' => 'PlayStation'],
        ['slug' => 'nintendo', 'name' => 'Nintendo'],
    ],

    'regions' => [
        ['slug' => 'global', 'name' => 'Global'],
        ['slug' => 'eu', 'name' => 'EU'],
        ['slug' => 'north-america', 'name' => 'North America'],
    ],

    // Invented seller names: no real marketplace is named.
    'sellers' => [
        ['name' => 'PixelVault', 'rating' => '4.87'],
        ['name' => 'KeyHarbor', 'rating' => '4.62'],
        ['name' => 'LootLane', 'rating' => '4.31'],
        ['name' => 'Aurora Keys', 'rating' => '3.95'],
        ['name' => 'Bytebay', 'rating' => '3.42'],
    ],

    'products' => [
        ['title' => 'The Witcher 3: Wild Hunt', 'platform' => 'steam', 'region' => 'global', 'release_date' => '2015-05-19', 'msrp_cents' => 2999,
            'description' => 'Hunt monsters for coin and track down the child of prophecy across a war-torn open world shaped by your choices.'],
        ['title' => 'The Witcher 3: Wild Hunt', 'platform' => 'xbox', 'region' => 'eu', 'release_date' => '2015-05-19', 'msrp_cents' => 2999,
            'description' => 'The monster-slaying epic on Xbox, with both story expansions sold separately.'],
        ['title' => 'Cyberpunk 2077', 'platform' => 'steam', 'region' => 'global', 'release_date' => '2020-12-10', 'msrp_cents' => 5999,
            'description' => 'An open-world action RPG set in a neon megacity where implants, gangs and corporations decide who survives.'],
        ['title' => 'Cyberpunk 2077', 'platform' => 'playstation', 'region' => 'eu', 'release_date' => '2020-12-10', 'msrp_cents' => 5999,
            'description' => 'Night City on PlayStation: build your mercenary, pick your cyberware and chase an immortality chip.'],
        ['title' => 'Elden Ring', 'platform' => 'steam', 'region' => 'global', 'release_date' => '2022-02-25', 'msrp_cents' => 5999,
            'description' => 'A vast, punishing fantasy world to explore on foot or horseback, full of hidden dungeons and towering bosses.'],
        ['title' => 'Elden Ring', 'platform' => 'xbox', 'region' => 'north-america', 'release_date' => '2022-02-25', 'msrp_cents' => 5999,
            'description' => 'The open-world action RPG on Xbox. Rise, become a lord and face demigods in the Lands Between.'],
        ['title' => 'Red Dead Redemption 2', 'platform' => 'steam', 'region' => 'global', 'release_date' => '2019-11-05', 'msrp_cents' => 5999,
            'description' => 'Ride with an outlaw gang through the last days of the American frontier in a detailed open world.'],
        ['title' => 'Red Dead Redemption 2', 'platform' => 'playstation', 'region' => 'north-america', 'release_date' => '2018-10-26', 'msrp_cents' => 5999,
            'description' => 'The western epic on PlayStation, including access to the online frontier.'],
        ['title' => 'Minecraft', 'platform' => 'xbox', 'region' => 'global', 'release_date' => '2011-11-18', 'msrp_cents' => 2999,
            'description' => 'Gather, craft and build anything you can imagine in endless block worlds, alone or with friends.'],
        ['title' => 'Minecraft', 'platform' => 'nintendo', 'region' => 'eu', 'release_date' => '2018-06-21', 'msrp_cents' => 2999,
            'description' => 'The block-building sandbox on Nintendo Switch, with cross-play to other Bedrock editions.'],
        ['title' => "Baldur's Gate 3", 'platform' => 'steam', 'region' => 'global', 'release_date' => '2023-08-03', 'msrp_cents' => 5999,
            'description' => 'A party-based RPG with turn-based combat, where almost every problem has more than one answer.'],
        ['title' => 'Hogwarts Legacy', 'platform' => 'playstation', 'region' => 'eu', 'release_date' => '2023-02-10', 'msrp_cents' => 6999,
            'description' => 'Attend a wizarding school in the 1800s, learn spells and explore the castle and the highlands around it.'],
        ['title' => 'Grand Theft Auto V', 'platform' => 'steam', 'region' => 'global', 'release_date' => '2015-04-14', 'msrp_cents' => 2999,
            'description' => 'Three criminals, one sprawling city and a string of heists that keep getting bigger.'],
        ['title' => 'FIFA 23', 'platform' => 'steam', 'region' => 'global', 'release_date' => '2022-09-30', 'msrp_cents' => 6999,
            'description' => 'Club football with licensed leagues, career mode and online squad building.'],
        ['title' => 'Stardew Valley', 'platform' => 'steam', 'region' => 'global', 'release_date' => '2016-02-26', 'msrp_cents' => 1399,
            'description' => 'Inherit an overgrown farm, grow crops, raise animals and get to know a small country town.'],
        ['title' => 'Hollow Knight', 'platform' => 'nintendo', 'region' => 'global', 'release_date' => '2018-06-12', 'msrp_cents' => 1499, 'out_of_stock' => true,
            'description' => 'A hand-drawn action adventure through a ruined underground kingdom of insects.'],
        ['title' => 'The Legend of Zelda: Tears of the Kingdom', 'platform' => 'nintendo', 'region' => 'eu', 'release_date' => '2023-05-12', 'msrp_cents' => 6999,
            'description' => 'Explore the land and the floating islands above it, and fuse found objects into tools and vehicles.'],
        ['title' => 'Mario Kart 8 Deluxe', 'platform' => 'nintendo', 'region' => 'eu', 'release_date' => '2017-04-28', 'msrp_cents' => 5999,
            'description' => 'Kart racing for up to four players on one screen, or twelve online.'],
        ['title' => 'Forza Horizon 5', 'platform' => 'xbox', 'region' => 'global', 'release_date' => '2021-11-09', 'msrp_cents' => 5999,
            'description' => 'Open-world racing across a huge, varied map with hundreds of licensed cars.'],
        ['title' => 'Starfield', 'platform' => 'xbox', 'region' => 'global', 'release_date' => '2023-09-06', 'msrp_cents' => 6999,
            'description' => 'A space RPG: build a ship, join factions and explore a thousand planets.'],
        ['title' => 'God of War Ragnarök', 'platform' => 'playstation', 'region' => 'eu', 'release_date' => '2022-11-09', 'msrp_cents' => 6999,
            'description' => 'A father and son journey across the nine realms as the end of the world approaches.'],
        ['title' => "Ghost of Tsushima Director's Cut", 'platform' => 'steam', 'region' => 'global', 'release_date' => '2024-05-16', 'msrp_cents' => 5999,
            'description' => 'A samurai defends his island against invasion, choosing between honour and winning.'],
        ['title' => 'Sekiro: Shadows Die Twice', 'platform' => 'steam', 'region' => 'global', 'release_date' => '2019-03-22', 'msrp_cents' => 5999, 'out_of_stock' => true,
            'description' => 'A demanding sword-fighting game about a shinobi on a mission to rescue his lord.'],
        ['title' => 'Hades', 'platform' => 'steam', 'region' => 'global', 'release_date' => '2020-09-17', 'msrp_cents' => 2499,
            'description' => 'Battle out of the underworld again and again in a fast roguelike with a story that grows each run.'],

        ['title' => 'Steam Gift Card 20 EUR', 'platform' => 'steam', 'region' => 'global', 'release_date' => null, 'msrp_cents' => 2000, 'gift_card' => true,
            'description' => 'Adds 20 EUR to a Steam Wallet. Redeem the code in the Steam client.'],
        ['title' => 'Steam Gift Card 50 EUR', 'platform' => 'steam', 'region' => 'global', 'release_date' => null, 'msrp_cents' => 5000, 'gift_card' => true,
            'description' => 'Adds 50 EUR to a Steam Wallet. Redeem the code in the Steam client.'],
        ['title' => 'PlayStation Store Gift Card 25 EUR', 'platform' => 'playstation', 'region' => 'eu', 'release_date' => null, 'msrp_cents' => 2500, 'gift_card' => true,
            'description' => 'Adds 25 EUR to a PlayStation Network wallet for European accounts.'],
        ['title' => 'Xbox Gift Card 25 USD', 'platform' => 'xbox', 'region' => 'north-america', 'release_date' => null, 'msrp_cents' => 2299, 'gift_card' => true,
            'description' => 'Adds 25 USD to a Microsoft account registered in the United States.'],
        ['title' => 'Nintendo eShop Card 25 EUR', 'platform' => 'nintendo', 'region' => 'eu', 'release_date' => null, 'msrp_cents' => 2500, 'gift_card' => true,
            'description' => 'Adds 25 EUR to a Nintendo Account for the European eShop.'],
        ['title' => 'Xbox Game Pass Ultimate 3 Months', 'platform' => 'xbox', 'region' => 'global', 'release_date' => null, 'msrp_cents' => 5397, 'gift_card' => true,
            'description' => 'Three months of Game Pass Ultimate: a rotating game library on console, PC and cloud.'],
    ],

    'banners' => [
        ['title' => 'Elden Ring', 'subtitle' => 'Compare offers from trusted sellers', 'image_url' => '/placeholders/banner-1.svg', 'link_url' => '/product/elden-ring-steam-global'],
        ['title' => 'Gift cards, delivered instantly', 'subtitle' => 'Steam, PlayStation, Xbox and Nintendo', 'image_url' => '/placeholders/banner-2.svg', 'link_url' => '/store?q=gift+card'],
        ['title' => 'Prices below retail', 'subtitle' => 'Keys from sellers across the EU', 'image_url' => '/placeholders/banner-3.svg', 'link_url' => '/store?sort=price_asc'],
    ],

    'homepage_blocks' => [
        ['type' => 'hero_banner', 'title' => 'Featured', 'config' => ['limit' => 5]],
        // 90 days, not 30: production is seeded once, so a 30-day window would empty this block a month after the first deploy.
        ['type' => 'best_sellers', 'title' => 'Best sellers', 'config' => ['limit' => 12, 'days' => 90, 'link_url' => '/store?sort=bestselling']],
        ['type' => 'deals', 'title' => 'Deals', 'config' => ['limit' => 12, 'min_discount' => 10]],
    ],
];
