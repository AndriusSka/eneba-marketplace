<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Route as RouteDefinition;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;
use Illuminate\Testing\TestResponse;

uses(RefreshDatabase::class);

// The SPA's origin (a SANCTUM_STATEFUL_DOMAINS host): requests from it get the session.
const SPA_ORIGIN = 'http://localhost:5173';

beforeEach(function () {
    $this->withHeader('Origin', SPA_ORIGIN);
});

/**
 * Makes the next test request behave like a fresh browser request (a page reload): the test app's
 * cached guards are dropped, and the only thing carried over is the session cookie from `$response`.
 */
function asNextRequestWithCookieFrom(TestResponse $response): void
{
    $name = config('session.cookie');
    $cookie = $response->getCookie($name);
    expect($cookie)->not->toBeNull()
        ->and($cookie->isHttpOnly())->toBeTrue();

    app('auth')->forgetGuards();
    test()->withCookie($name, (string) $cookie->getValue());
}

/** @return array<string, string> */
function registration(array $overrides = []): array
{
    return $overrides + [
        'name' => 'Ada Lovelace',
        'email' => 'ada@example.com',
        'password' => 'correct-horse',
        'password_confirmation' => 'correct-horse',
    ];
}

describe('register', function () {
    it('creates the user, signs them in and stores only a password hash', function () {
        $response = $this->postJson('/api/register', registration(['email' => '  Ada@Example.com ']))
            ->assertCreated()
            ->assertExactJson(['data' => ['id' => User::sole()->id, 'name' => 'Ada Lovelace', 'email' => 'ada@example.com']]);

        $user = User::sole();
        expect($user->email)->toBe('ada@example.com')
            ->and($user->getRawOriginal('password'))->not->toBe('correct-horse')
            ->and(Hash::check('correct-horse', $user->getRawOriginal('password')))->toBeTrue();
        $this->assertAuthenticatedAs($user, 'web');

        asNextRequestWithCookieFrom($response);
        $this->getJson('/api/me')->assertOk()->assertJsonPath('data.email', 'ada@example.com');
    });

    it('rejects invalid input with errors on the fields', function (array $input, array $fields) {
        User::factory()->create(['email' => 'taken@example.com']);

        $this->postJson('/api/register', $input)
            ->assertUnprocessable()
            ->assertOnlyJsonValidationErrors($fields);

        $this->assertGuest('web');
        expect(User::count())->toBe(1);
    })->with([
        'missing fields' => [[], ['name', 'email', 'password']],
        'email taken (other case)' => [registration(['email' => 'TAKEN@example.com']), ['email']],
        'invalid email' => [registration(['email' => 'not-an-email']), ['email']],
        'short password' => [registration(['password' => 'short', 'password_confirmation' => 'short']), ['password']],
        'confirmation mismatch' => [registration(['password_confirmation' => 'different-one']), ['password']],
    ]);
});

describe('login', function () {
    beforeEach(function () {
        $this->user = User::factory()->create(['email' => 'demo@example.com', 'password' => 'password']);
    });

    it('signs in with valid credentials, and a reload with the session cookie stays signed in', function () {
        $response = $this->postJson('/api/login', ['email' => 'Demo@Example.com', 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('data.id', $this->user->id);

        $this->assertAuthenticatedAs($this->user, 'web');
        asNextRequestWithCookieFrom($response);
        $this->getJson('/api/me')->assertOk()->assertJsonPath('data.email', 'demo@example.com');
    });

    it('rejects a wrong password and an unknown email with the same message', function (string $email, string $password) {
        $this->postJson('/api/login', ['email' => $email, 'password' => $password])
            ->assertUnprocessable()
            ->assertOnlyJsonValidationErrors(['email'])
            ->assertJsonPath('errors.email.0', 'These credentials do not match our records.');

        $this->assertGuest('web');
    })->with([
        'wrong password' => ['demo@example.com', 'wrong-password'],
        'unknown email' => ['nobody@example.com', 'password'],
    ]);

    it('requires email and password', function () {
        $this->postJson('/api/login', [])->assertUnprocessable()->assertOnlyJsonValidationErrors(['email', 'password']);
    });

    it('locks the email out after 5 failures, even for the right password', function () {
        foreach (range(1, 5) as $_) {
            $this->postJson('/api/login', ['email' => 'demo@example.com', 'password' => 'wrong'])->assertUnprocessable();
        }

        $this->postJson('/api/login', ['email' => 'demo@example.com', 'password' => 'password'])
            ->assertTooManyRequests()
            ->assertJsonValidationErrors(['email']);

        $this->assertGuest('web');
    });

    it('clears the failure count after a successful sign-in', function () {
        foreach (range(1, 4) as $_) {
            $this->postJson('/api/login', ['email' => 'demo@example.com', 'password' => 'wrong'])->assertUnprocessable();
        }
        $this->postJson('/api/login', ['email' => 'demo@example.com', 'password' => 'password'])->assertOk();
        $this->postJson('/api/logout')->assertNoContent();

        $this->postJson('/api/login', ['email' => 'demo@example.com', 'password' => 'wrong'])->assertUnprocessable();
        $this->postJson('/api/login', ['email' => 'demo@example.com', 'password' => 'password'])->assertOk();
    });
});

it('signs out on the server: the old session cookie no longer works', function () {
    $user = User::factory()->create(['password' => 'password']);
    $login = $this->postJson('/api/login', ['email' => $user->email, 'password' => 'password'])->assertOk();

    asNextRequestWithCookieFrom($login);
    $this->postJson('/api/logout')->assertNoContent();
    $this->assertGuest('web');

    asNextRequestWithCookieFrom($login);
    $this->getJson('/api/me')->assertUnauthorized();
});

it('gives a new session id on sign-in', function () {
    $user = User::factory()->create(['password' => 'password']);
    $guestVisit = $this->get('/sanctum/csrf-cookie');
    $before = $guestVisit->getCookie(config('session.cookie'))->getValue();

    asNextRequestWithCookieFrom($guestVisit);
    $after = $this->postJson('/api/login', ['email' => $user->email, 'password' => 'password'])
        ->assertOk()
        ->getCookie(config('session.cookie'))->getValue();

    expect($after)->not->toBe($before);
});

it('returns 401 JSON to a guest on every signed-in route', function () {
    $routes = collect(Route::getRoutes()->getRoutes())
        ->filter(fn (RouteDefinition $route) => in_array('auth:sanctum', $route->gatherMiddleware(), true));

    // Guards the walk itself: M6 adds /api/checkout and /api/orders to the same group.
    expect($routes->map->uri()->all())->toContain('api/me', 'api/logout');

    foreach ($routes as $route) {
        $uri = '/'.preg_replace('/\{[^}]+\}/', '1', $route->uri());
        foreach (array_diff($route->methods(), ['HEAD']) as $method) {
            $this->json($method, $uri)
                ->assertUnauthorized()
                ->assertExactJson(['message' => 'Unauthenticated.']);
        }
    }
});

it('issues the XSRF-TOKEN cookie the SPA sends back as X-XSRF-TOKEN', function () {
    $this->get('/sanctum/csrf-cookie')->assertNoContent()->assertCookie('XSRF-TOKEN');
});

describe('CORS is closed', function () {
    it('sends no Access-Control-Allow-Origin to a foreign origin', function () {
        $this->withHeader('Origin', 'https://evil.example')
            ->getJson('/api/products')
            ->assertOk()
            ->assertHeaderMissing('Access-Control-Allow-Origin');
    });

    it('sends no Access-Control-Allow-Origin on a preflight', function () {
        $this->call('OPTIONS', '/api/login', server: [
            'HTTP_ORIGIN' => 'https://evil.example',
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'POST',
            'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'content-type,x-xsrf-token',
        ])->assertHeaderMissing('Access-Control-Allow-Origin')
            ->assertHeaderMissing('Access-Control-Allow-Credentials');
    });
});
