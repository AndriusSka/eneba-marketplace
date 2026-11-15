co> The Authentication milestone from @docs/PLAN.md.

> Goal: register, sign in, sign out; checkout and order history only for
> signed-in users; after signing in, return the user to the page they came
> from.
> Constraints: Laravel Sanctum API tokens, because frontend and backend are on
> different domains; hashed passwords; validation errors shown next to the form
> fields.
> Done when: tests cover registering, a wrong password, and a protected
> endpoint returning 401 without a token; refreshing the page keeps me signed
> in.
> Explain where the token is stored on the frontend and the trade-off of that
> choice.
> ⎿  Read docs\PLAN.md (199 lines)

Searched for 5 patterns, read 10 files (ctrl+o to expand)

● User answered Claude's questions:
⎿  · Your request says to use Sanctum API tokens because the frontend and
backend are on different domains. But in this project the browser only
talks to the Vercel origin: frontend/vercel.json already proxies /api and
/sanctum to Render, and ARCHITECTURE.md › Authentication and PLAN.md M5
specify Sanctum SPA mode (httpOnly session cookie, no token in JS, CORS
closed). Which should M5 use? → SPA cookie (Recommended)

Searched for 2 patterns, read 2 files (ctrl+o to expand)

● Updated plan
⎿  /plan to preview

● User approved Claude's plan
⎿  Plan saved to:
~\.claude\plans\pasted-content-id-e08b-the-authenticati-wiggly-crab.md ·
/plan to edit
M5 — Authentication (Sanctum SPA cookie mode)

     Context

     M5 adds register, sign in and sign out. Checkout and order history become
     sign-in only, and after signing in the user goes back to the page they came
     from. You confirmed Sanctum SPA cookie mode, not bearer tokens. The
     browser only ever talks to the Vercel origin (frontend/vercel.json already
     proxies /api and /sanctum to Render, and Vite does the same locally), so
     the session cookie is first-party. This matches ARCHITECTURE.md ›
     Authentication and PLAN.md M5. Passwords are hashed through the existing
     'password' => 'hashed' cast in backend/app/Models/User.php. The sessions
     table already exists (default users migration), and production already uses
     SESSION_DRIVER=database.

     New dependency (needs your OK, granted by approving this plan): composer
     require laravel/sanctum (not installed yet; ARCHITECTURE.md names it). I
     publish only its config (--tag=sanctum-config). SPA mode doesn't use
     personal_access_tokens, so that migration isn't published.

     Branch: feat/m5-auth, created from the current feat/m7-homepage HEAD
     because M7 isn't on main yet. Rebase onto main after M7 merges. I won't
     commit until you ask.

     Backend (backend/)

     1. bootstrap/app.php: add $middleware->statefulApi() (Sanctum's
        EnsureFrontendRequestsAreStateful: session plus CSRF for requests from
        stateful domains) and $middleware->trustProxies(at: '*') (Vercel →
        Render LB, so https and the host are detected correctly).
     2. config/sanctum.php (published): stateful domains come from
        SANCTUM_STATEFUL_DOMAINS.
        - Local: .env.example and .env.testing.example get
          SANCTUM_STATEFUL_DOMAINS=localhost:5173.
        - Tests: phpunit.xml gets the same value, so tests don't depend on a
          local file.
        - Production: SANCTUM_STATEFUL_DOMAINS=eneba-marketplace-rosy.vercel.app
          goes into the Dockerfile ENV. The value isn't secret, and baking it
          in removes a manual Render dashboard step. This is a small change from
          ARCHITECTURE.md, which listed it as a dashboard var; I'll update that
          row and CLAUDE.md.
     3. config/cors.php (published), closed explicitly: allowed_origins => [],
        supports_credentials => false.
     4. Routes, routes/api.php:
        - POST /register, POST /login
        - an auth:sanctum group with POST /logout and GET /me
        - M6 adds checkout and orders inside the same group.
     5. app/Http/Requests/RegisterRequest.php:
        - name required|string|max:255
        - email required|email|max:255|unique:users
        - password required|confirmed|Password::defaults() (min 8)
        - The email is lower-cased and trimmed in prepareForValidation.
     6. app/Http/Requests/LoginRequest.php:
        - email, password required, with the same email normalization.
        - The throttle key is lower(email)|ip.
     7. app/Services/Auth/AuthService.php (the logic lives in a service):
        - register(data): create the user, Auth::guard('web')->login, regenerate
          the session.
        - login(email, password, throttleKey):
          - Check the limiter first: 5 failures a minute → ValidationException
            on email, status 429, with "Too many attempts. Try again in N
            seconds."
          - Call Auth::attempt. On failure, hit the limiter and return 422 on
            email with "These credentials do not match our records." The message
            is the same for an unknown email and a wrong password, so it
            doesn't reveal which emails have accounts.
          - On success, clear the limiter and regenerate the session (prevents
            session fixation).
        - logout(): log out the web guard, invalidate the session and regenerate
          the CSRF token.
     8. app/Http/Controllers/AuthController.php (thin):
        - register → 201 UserResource
        - login → 200 UserResource
        - logout → 204
        - me → 200 UserResource
     9. app/Http/Resources/UserResource.php: {id, name, email}.
     10. Unauthenticated /api/* already renders JSON through
         shouldRenderJsonWhen, so a guest gets 401
         {"message":"Unauthenticated."} with no redirect. A test checks this.

     Frontend (frontend/src/)

     1. api/client.ts:
        - ApiError gains errors?: Record<string, string[]>, narrowed from
          unknown in guards.ts style.
        - New sendJson(method, path, body?):
          - Before a state-changing call, if there's no XSRF-TOKEN cookie, it
            calls GET /sanctum/csrf-cookie.
          - It sends X-XSRF-TOKEN (the decoded cookie) with credentials:
            'same-origin'.
          - On a 419 (CSRF expired) it fetches a new cookie and retries once.
     2. api/auth.ts:
        - useMe(): query key ['me']. A 401 resolves to null instead of an error,
          and staleTime is a few minutes.
        - useLogin / useRegister: on success, setQueryData(['me'], user).
        - useLogout: on success, setQueryData(['me'], null) and remove the
          user-scoped queries.
        - Response bodies are narrowed with a isUser guard.
     3. features/auth/safeNext.ts: accepts next only if it starts with / and not
        // or /\, and otherwise falls back to /. This prevents an open
        redirect.
     4. features/auth/RequireAuth.tsx:
        - While useMe loads, it shows a skeleton.
        - With null, it does <Navigate to="/login?next=<path+search>" replace>.
        - Otherwise it renders <Outlet/>.
        - M6 mounts it around /checkout and /orders/*. In M5 it's covered by a
          Vitest test with a test route, so no placeholder pages are added.
     5. components/TextField.tsx: label above the input, the input, and an error
        line in the danger token, wired with aria-invalid / aria-describedby.
        It uses the field token and rounded-sm, from DESIGN.md tokens only.
     6. features/auth/LoginPage.tsx and RegisterPage.tsx:
        - The server's errors are shown under each field, and a non-field
          message (e.g. 429) above the form.
        - The submit button is disabled while the request is pending.
        - On success → navigate(safeNext(next), {replace:true}).
        - A signed-in visitor who opens the page is redirected to next straight
          away.
        - Each page links to the other and keeps ?next=.
     7. features/auth/UserMenu.tsx in components/Layout.tsx:
        - Signed out: "Sign in | Register" links carry ?next=<current
          path+search>, so signing in from any page goes back to it.
        - Signed in: the name plus "Sign out".
        - It replaces the M5/M6 comment on Layout.tsx:28 (the cart comes in M6).
     8. routes.tsx: add /login and /register.

     Docs

     - ARCHITECTURE.md › Authentication:
       - CORS is closed and why: the Laravel default ['*'] was never a decision.
       - Login throttle returns 429.
       - SANCTUM_STATEFUL_DOMAINS is baked into the image.
       - A short "where the credential lives" paragraph (below).
     - Deployment row and CLAUDE.md: the env list is updated.
     - PLAN.md: M5 boxes ticked, plus a "Verified" note once checks pass. One
       change from the plan: the guest-401 test on /api/checkout and /api/orders
       works by walking every route with auth:sanctum middleware and
       asserting 401. So it covers /me and /logout now and picks up the M6
       routes automatically.

     Where the credential is stored, and the trade-off (for the final answer and
     ARCHITECTURE.md)

     - Storage: no token is kept in JavaScript, localStorage or React state.
       - The credential is Laravel's session cookie (httpOnly, Secure,
         SameSite=Lax, host-only on the Vercel origin). The session row lives in
         Postgres.
       - The only thing JS reads is the non-secret XSRF-TOKEN cookie, used for
         CSRF.
       - On reload, useMe() calls /api/me and the browser sends the cookie
         automatically, so the user stays signed in.
     - Gains:
       - An XSS bug can't read or steal the credential, unlike a bearer token in
         localStorage.
       - Logout really ends the session on the server.
       - Nothing needs refreshing or rotating on the client.
     - Costs:
       - CSRF has to be handled: the csrf-cookie round trip, the X-XSRF-TOKEN
         header and retry on 419. SameSite=Lax is a second layer.
       - It depends on the same-origin proxy: it would break if the API were
         called directly cross-origin.
       - Each request does a session lookup in the DB.
       - It doesn't suit non-browser clients (they'd use bearer tokens).
       - An XSS can still make requests as the user while the page is open; it
         just can't take the credential away with it.

     Verification

     - Pest (tests/Feature/AuthTest.php, requests sent with Origin:
       http://localhost:5173 so they're stateful):
       - register: 201, signed in, password stored hashed (Hash::check, ≠
         plaintext)
       - register validation: missing fields, duplicate email in another case,
         short password and a confirmation mismatch each give 422 with
         errors.<field>
       - login valid → 200, then /api/me returns the user
       - wrong password → 422 errors.email, still a guest; an unknown email
         gives the same message
       - 5 failures, then the 6th try (even with the right password) → 429
       - logout → 204, then /api/me → 401
       - every auth:sanctum route returns 401 for a guest
       - /sanctum/csrf-cookie sets XSRF-TOKEN
       - a foreign Origin on GET and on a preflight OPTIONS gets no
         Access-Control-Allow-Origin
     - Vitest:
       - client sends X-XSRF-TOKEN, fetches the cookie when it's missing and
         retries once on 419
       - safeNext cases
       - RequireAuth redirects to /login?next=… and renders for a user
       - LoginPage shows field errors from a 422 and navigates to next on
         success
       - UserMenu shows sign-in links with next when signed out and the name
         when signed in
     - Run php artisan test, vendor/bin/pint --test, npm run lint, npm run
       typecheck, npm run test and npm run build.
     - Manual (local, Vite + artisan serve):
       - Register, reload and stay signed in.
       - Sign out.
       - From /product/<slug>, click Sign in, sign in and land back on the
         product.
       - A wrong password shows the error under the field.
     - Production (after merge): sign in on
       https://eneba-marketplace-rosy.vercel.app, reload and stay signed in.
       This confirms the cookie survives the Vercel → Render proxy. The PLAN box
       for that check is ticked only after it passes.

● Bash(git checkout -b feat/m5-auth && cd backend && composer require
laravel/sanctum 2>&1 | tail -15)
⎿  Updated backend\composer.json (+1 -0)
⎿  Updated backend\composer.lock (+66 -1)
⎿  (a git step in this command can move the working tree, so these may be
its changes, not edits) (ctrl+o to expand)
⎿  (files that changed while this command ran, by the command or by
another process; a convenience view, not a review or audit of the
command)
⎿  (timeout 5m)

● Bash(php -v | head -1 && php artisan vendor:publish --tag=sanctum-config &&
php artisan config:publish cors && cat config/sanctum.php | grep -v
'^\s*|' && cat config…)
⎿  Created backend\config\cors.php (+34 -0)
1 +<?php  
 2 +  
 3 +return [  
 4 +  
 5 + /*  
 6 + |----------------------------------------------------------
+----------------  
 7 + | Cross-Origin Resource Sharing (CORS) Configuration  
 8 + |----------------------------------------------------------
+----------------  
 9 + |  
 10 + | Here you may configure your settings for cross-origin res
+ource sharing  
 11 + | or "CORS". This determines what cross-origin operations m
+ay execute  
 12 + | in web browsers. You are free to adjust these settings as + needed.  
 13 + |  
 14 + | To learn more: https://developer.mozilla.org/en-US/docs/W
+eb/HTTP/CORS  
 15 + |  
 16 + _/  
 17 +  
 18 + 'paths' => ['api/_', 'sanctum/csrf-cookie'],  
 19 +  
 20 + 'allowed*methods' => ['*'],  
 21 +  
 22 + 'allowed_origins' => ['*'],  
 23 +  
 24 + 'allowed_origins_patterns' => [],  
 25 +  
 26 + 'allowed_headers' => ['*'],  
 27 +  
 28 + 'exposed_headers' => [],  
 29 +  
 30 + 'max_age' => 0,  
 31 +  
 32 + 'supports_credentials' => false,  
 33 +  
 34 +];  
 ⎿  Created backend\config\sanctum.php (+87 -0)
1 +<?php  
 2 +  
 3 +use Illuminate\Cookie\Middleware\EncryptCookies;  
 4 +use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;  
 5 +use Laravel\Sanctum\Http\Middleware\AuthenticateSession;  
 6 +use Laravel\Sanctum\Sanctum;  
 7 +  
 8 +return [  
 9 +  
 10 + /*  
 11 + |----------------------------------------------------------
+----------------  
 12 + | Stateful Domains  
 13 + |----------------------------------------------------------
+----------------  
 14 + |  
 15 + | Requests from the following domains / hosts will receive
+stateful API  
 16 + | authentication cookies. Typically, these should include y
+our local  
 17 + | and production domains which access your API via a fronte
+nd SPA.  
 18 + |  
 19 + _/  
 20 +  
 21 + 'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS',
+sprintf(  
 22 + '%s%s',  
 23 + 'localhost,localhost:3000,127.0.0.1,127.0.0.1:8000,::1'
+,  
 24 + Sanctum::currentApplicationUrlWithPort(),  
 25 + // Sanctum::currentRequestHost(),  
 26 + ))),  
 27 +  
 28 + /_  
 29 + |----------------------------------------------------------
+----------------  
 30 + | Sanctum Guards  
 31 + |----------------------------------------------------------
+----------------  
 32 + |  
 33 + | This array contains the authentication guards that will b
+e checked when  
 34 + | Sanctum is trying to authenticate a request. If none of t
+hese guards  
 35 + | are able to authenticate the request, Sanctum will use th
+e bearer  
 36 + | token that's present on an incoming request for authentic
+ation.  
 37 + |  
 38 + \_/  
 39 +  
 40 + 'guard' => ['web'],  
 … 47 more lines (ctrl+o to expand)

Ran 1 shell command (ctrl+o to expand)

● No Python here; I'll use the Edit tool.

Read 2 files (ctrl+o to expand)

● Update(backend\config\sanctum.php)
⎿  Added 3 lines, removed 6 lines
18 |
19 _/
20  
 21 - 'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS',
-sprintf(  
 22 - '%s%s',  
 23 - 'localhost,localhost:3000,127.0.0.1,127.0.0.1:8000,::1'
-,  
 24 - Sanctum::currentApplicationUrlWithPort(),  
 25 - // Sanctum::currentRequestHost(),  
 26 - ))),  
 21 + // The SPA is served from one origin: the Vite dev server l
+ocally (the default below) and the  
 22 + // Vercel URL in production (set in the Dockerfile). Reques
+ts from these hosts get a session.  
 23 + 'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS',
+'localhost:5173')),  
 24  
 25 /_
26 |----------------------------------------------------------

---

● Update(backend\config\sanctum.php)
⎿  Removed 1 line
3 use Illuminate\Cookie\Middleware\EncryptCookies;
4 use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
5 use Laravel\Sanctum\Http\Middleware\AuthenticateSession;
6 -use Laravel\Sanctum\Sanctum;  
 6  
 7 return [
8

● Update(backend\config\cors.php)
⎿  Added 4 lines, removed 1 line
19  
 20 'allowed_methods' => ['*'],
21  
 22 - 'allowed_origins' => ['*'],  
 22 + // Closed on purpose. The SPA calls the API on its own orig
+in (the Vercel rewrite in production, the  
 23 + // Vite proxy locally), so no browser request needs CORS. L
+aravel's unpublished default allowed every  
 24 + // origin; with an empty list no Access-Control-Allow-Origi
+n header is sent to anyone.  
 25 + 'allowed_origins' => [],  
 26  
 27 'allowed_origins_patterns' => [],
28

Read 1 file, ran 1 shell command (ctrl+o to expand)

● Now the backend files.

● Update(backend\bootstrap\app.php)
⎿  Added 6 lines, removed 1 line
14 health: '/up',
15 )
16 ->withMiddleware(function (Middleware $middleware): void {
17 - //  
 17 + // Sanctum SPA auth: requests from SANCTUM_STATEFUL_DOM
+AINS get the session and CSRF check.  
 18 + $middleware->statefulApi();  
 19 +  
 20 + // Requests arrive through Vercel's rewrite and Render'
+s load balancer. Trusting the forwarded  
 21 + // headers lets Laravel see https and the public host,
+so the Secure session cookie is issued.  
 22 + $middleware->trustProxies(at: '\*');  
 23 })
24 ->withExceptions(function (Exceptions $exceptions): void {
25 $exceptions->shouldRenderJsonWhen(

● Write(backend\app\Http\Requests\RegisterRequest.php)
⎿  Wrote 27 lines to backend\app\Http\Requests\RegisterRequest.php
1 <?php
2
3 namespace App\Http\Requests;
4
5 use Illuminate\Foundation\Http\FormRequest;
6 use Illuminate\Validation\Rules\Password;
7
8 final class RegisterRequest extends FormRequest
9 {
10 protected function prepareForValidation(): void
… +17 lines (ctrl+o to expand)

● Write(backend\app\Http\Requests\LoginRequest.php)
⎿  Wrote 30 lines to backend\app\Http\Requests\LoginRequest.php
1 <?php
2
3 namespace App\Http\Requests;
4
5 use Illuminate\Foundation\Http\FormRequest;
6
7 final class LoginRequest extends FormRequest
8 {
9 protected function prepareForValidation(): void
10 {
… +20 lines (ctrl+o to expand)

● Write(backend\app\Services\Auth\AuthService.php)
⎿  Wrote 72 lines to backend\app\Services\Auth\AuthService.php
1 <?php
2
3 namespace App\Services\Auth;
4
5 use App\Models\User;
6 use Illuminate\Contracts\Session\Session;
7 use Illuminate\Support\Facades\Auth;
8 use Illuminate\Support\Facades\RateLimiter;
9 use Illuminate\Validation\ValidationException;
… +63 lines (ctrl+o to expand)

● Write(backend\app\Http\Resources\UserResource.php)
⎿  Wrote 21 lines to backend\app\Http\Resources\UserResource.php
1 <?php
2
3 namespace App\Http\Resources;
4
5 use App\Models\User;
6 use Illuminate\Http\Request;
7 use Illuminate\Http\Resources\Json\JsonResource;
8
9 /\*_ @mixin User _/
10 final class UserResource extends JsonResource
… +11 lines (ctrl+o to expand)

● Write(backend\app\Http\Controllers\AuthController.php)
⎿  Wrote 51 lines to backend\app\Http\Controllers\AuthController.php
1 <?php
2
3 namespace App\Http\Controllers;
4
5 use App\Http\Requests\LoginRequest;
6 use App\Http\Requests\RegisterRequest;
7 use App\Http\Resources\UserResource;
8 use App\Services\Auth\AuthService;
9 use Illuminate\Http\JsonResponse;
10 use Illuminate\Http\Request;
… +41 lines (ctrl+o to expand)
● Write(backend\routes\api.php)
⎿  Added 10 lines
1 <?php
2  
 3 +use App\Http\Controllers\AuthController;  
 4 use App\Http\Controllers\HealthController;
5 use App\Http\Controllers\HomeController;
6 use App\Http\Controllers\ProductController;
...
16 Route::get('/products', [ProductController::class, 'index']);
17 // A plain string slug (no model binding), so a 404 never names
a model class.
18 Route::get('/products/{slug}', [ProductController::class, 'show
']);
19 +  
 20 +Route::post('/register', [AuthController::class, 'register']);
21 +Route::post('/login', [AuthController::class, 'login']);  
 22 +  
 23 +// Signed-in only. A guest gets 401 JSON. Checkout and orders j
+oin this group in M6.  
 24 +Route::middleware('auth:sanctum')->group(function () {  
 25 + Route::post('/logout', [AuthController::class, 'logout']);
26 + Route::get('/me', [AuthController::class, 'me']);  
 27 +});

● Update(backend\.env.example)
⎿  Added 3 lines
27 SESSION_PATH=/
28 SESSION_DOMAIN=null
29  
 30 +# Hosts that get cookie (session) auth: the Vite dev server. co
+nfig/sanctum.php defaults to this too.  
 31 +SANCTUM_STATEFUL_DOMAINS=localhost:5173  
 32 +  
 33 CACHE_STORE=database
34 QUEUE_CONNECTION=sync
35 BROADCAST_CONNECTION=log

● Update(backend\Dockerfile)
⎿  Added 1 line
10 LOG_CHANNEL=stderr \
 11 DB_CONNECTION=pgsql \
 12 SESSION_DRIVER=database \
 13 + SANCTUM_STATEFUL_DOMAINS=eneba-marketplace-rosy.vercel.app
+\  
 14 CACHE_STORE=database \
 15 QUEUE_CONNECTION=sync \
 16 PHP_OPCACHE_ENABLE=1 \

● Update(backend\Dockerfile)
⎿  Added 1 line
1 FROM serversideup/php:8.4-fpm-nginx
2  
 3 # Non-secret production defaults. Secrets (APP_KEY, DB_URL) and
APP_URL come from the Render dashboard.
4 +# SANCTUM_STATEFUL_DOMAINS is the public Vercel host the browser + sees; requests from it get cookie auth.  
 5 # The image's Laravel automations run on every container start,
before nginx starts:
6 # storage:link (off: no public disk), migrate --force --seed (wa
its for the DB), then optimize (caches config with runtime env).
7 # The seeder fills an empty database once and is a no-op afterwa
rds (it skips when products exist), so

● Now the Pest tests.

● Write(backend\tests\Feature\AuthTest.php)
⎿  Wrote 163 lines to backend\tests\Feature\AuthTest.php
1 <?php
2
3 use App\Models\User;
4 use Illuminate\Foundation\Testing\RefreshDatabase;
5 use Illuminate\Routing\Route as RouteDefinition;
6 use Illuminate\Support\Facades\Hash;
7 use Illuminate\Support\Facades\Route;
8
9 uses(RefreshDatabase::class);
… +154 lines (ctrl+o to expand)

Ran 1 shell command (ctrl+o to expand)

● Two test failures come from the harness reusing guard instances, so Sanctum
keeps a stale user and the 201 from the model just created. I'm switching the
follow-up requests to carry only the session cookie, as a browser reload
would. · summary

Searched for 1 pattern (ctrl+o to expand)

● Bash(cat > /tmp/patch.php <<'EOF'

<?php…)
⎿  Updated backend\tests\Feature\AuthTest.php (+38 -6)
5 use Illuminate\Routing\Route as RouteDefinition;
6 use Illuminate\Support\Facades\Hash;
7 use Illuminate\Support\Facades\Route;
8 +use Illuminate\Testing\TestResponse;  
 9  
 10 uses(RefreshDatabase::class);
11  
 ...
16 $this->withHeader('Origin', SPA_ORIGIN);
      17  });
      18  
      19 +/**                                                            
      20 + * Makes the next test request behave like a fresh browser requ
         +est (a page reload): the test app's                            
      21 + * cached guards are dropped, and the only thing carried over i
         +s the session cookie from `$response`.  
 22 + _/  
 23 +function asNextRequestWithCookieFrom(TestResponse $response): v
         +oid                                                            
      24 +{                                                              
      25 +    $name = config('session.cookie');                          
      26 +    $cookie = $response->getCookie($name);  
 27 + expect($cookie)->not->toBeNull()                           
      28 +        ->and($cookie->isHttpOnly())->toBeTrue();  
 29 +  
 30 + app('auth')->forgetGuards();  
 31 + test()->withCookie($name, (string) $cookie->getValue());  
 32 +}  
 33 +  
 34 /\*\* @return array<string, string> _/
35 function registration(array $overrides = []): array
      36  {
     ...
      44  
      45  describe('register', function () {
      46      it('creates the user, signs them in and stores only a passw
          ord hash', function () {
      31 -        $this->postJson('/api/register', registration(['email' 
         -=> '  Ada@Example.com ']))                                     
      47 +        $response = $this->postJson('/api/register', registrati
         +on(['email' => '  Ada@Example.com ']))                         
      48              ->assertCreated()
      49              ->assertExactJson(['data' => ['id' => User::sole()-
          >id, 'name' => 'Ada Lovelace', 'email' => 'ada@example.com']]);
      50  
     ...
      54              ->and(Hash::check('correct-horse', $user->getRawOri
          ginal('password')))->toBeTrue();
      55          $this->assertAuthenticatedAs($user, 'web');
56  
 57 + asNextRequestWithCookieFrom($response);  
 … 51 more lines (ctrl+o to expand)
⎿  (timeout 5m)

● The session-id test I just wrote compares against the wrong request;
tightening it.

● Update(backend\tests\Feature\AuthTest.php)
⎿  Added 3 lines, removed 2 lines
145  
 146 it('gives a new session id on sign-in', function () {
147 $user = User::factory()->create(['password' => 'password']
           );
      148 -    $before = $this->get('/sanctum/csrf-cookie')->getCookie(co
          -nfig('session.cookie'))->getValue();                          
      148 +    $guestVisit = $this->get('/sanctum/csrf-cookie');         
      149 +    $before = $guestVisit->getCookie(config('session.cookie'))
          +->getValue();                                                 
      150  
      150 -    asNextRequestWithCookieFrom($this->get('/sanctum/csrf-cook
-ie'));  
 151 + asNextRequestWithCookieFrom($guestVisit);  
 152 $after = $this->postJson('/api/login', ['email' => $user->
email, 'password' => 'password'])
153 ->assertOk()
154 ->getCookie(config('session.cookie'))->getValue();

Ran 1 shell command (ctrl+o to expand)

● Backend: Pest 149/149, Pint clean. Now the frontend — first the existing
patterns.

Ran 2 shell commands (ctrl+o to expand)

● Writing the API layer: CSRF-aware sendJson in the client, then the auth hooks.

● Write(frontend\src\api\client.ts)
⎿  Added 102 lines, removed 6 lines
1 +import { isArrayOf, isObject, isString } from './guards'  
 2 +  
 3 +export type FieldErrors = Record<string, string[]>  
 4 +  
 5 export class ApiError extends Error {
6 readonly status: number
7 + /** Laravel validation errors (422, and 429 on login), keyed
+by field. \*/  
 8 + readonly errors: FieldErrors  
 9  
 4 - constructor(status: number, message: string) {  
 10 + constructor(status: number, message: string, errors: FieldErr
+ors = {}) {  
 11 super(message)
12 this.name = 'ApiError'
13 this.status = status
14 + this.errors = errors  
 15 }
16 }
17  
 ...
25 credentials: 'same-origin',
26 signal,
27 })
21 - const body: unknown = await response.json().catch(() => null
-)  
 28 + return parseResponse(response)  
 29 +}  
 30  
 31 +export type MutatingMethod = 'POST' | 'PUT' | 'PATCH' | 'DELET
+E'  
 32 +  
 33 +/**  
 34 + _ Send a state-changing request with Laravel's CSRF protectio
+n (ARCHITECTURE.md › Authentication).  
 35 + _  
 36 + _ Auth is the session cookie, which is httpOnly: this code ne
+ver sees it, the browser attaches it.  
 37 + _ The only cookie read here is XSRF-TOKEN, which is not a cre
+dential: it is echoed back as the  
 38 + _ X-XSRF-TOKEN header so Laravel knows the request came from
+our own page. If the cookie is missing  
 39 + _ it is fetched first, and a 419 (token expired with the sess
+ion) is retried once with a fresh one.  
 40 + _ Returns the parsed body as `unknown`, or null for an empty
+response such as 204.  
 41 + _/  
 42 +export async function sendJson(  
 43 + method: MutatingMethod,  
 44 + path: string,  
 45 + body?: unknown,  
 46 + headers: Record<string, string> = {},  
 47 +): Promise<unknown> {  
 48 + if (readCookie(XSRF_COOKIE) === undefined) {  
 49 + await refreshCsrfCookie()  
 50 + }  
 51 +  
 52 + let response = await send(method, path, body, headers)  
 53 + if (response.status === CSRF_MISMATCH) {  
 54 + await refreshCsrfCookie()  
 55 + response = await send(method, path, body, headers)  
 56 + }  
 57 + return parseResponse(response)  
 58 +}  
 59 +  
 60 +const XSRF_COOKIE = 'XSRF-TOKEN'  
 61 +const CSRF_MISMATCH = 419  
 62 +  
 63 +function send(method: MutatingMethod, path: string, body: unkn
+own, headers: Record<string, string>): Promise<Response> {  
 64 + return fetch(path, {  
 65 + method,  
 66 + headers: {  
 67 + Accept: 'application/json',  
 68 + ...(body === undefined ? {} : { 'Content-Type': 'applica
+tion/json' }),  
 69 + 'X-XSRF-TOKEN': readCookie(XSRF_COOKIE) ?? '',  
 70 + ...headers,  
 71 + },  
 72 + body: body === undefined ? undefined : JSON.stringify(body
+),  
 73 + credentials: 'same-origin',  
 74 + })  
 75 +}  
 76 +  
 77 +async function refreshCsrfCookie(): Promise<void> {  
 78 + const response = await fetch('/sanctum/csrf-cookie', {  
 79 + headers: { Accept: 'application/json' },  
 80 + credentials: 'same-origin',  
 81 + })  
 82 if (!response.ok) {
24 - throw new ApiError(response.status, messageFrom(body) ?? `
          -HTTP ${response.status}`)  
 83 + throw new ApiError(response.status, `HTTP ${response.statu
          +s}`)  
 84 }
85 +}  
 86  
 87 +/\*_ Laravel URL-encodes the XSRF-TOKEN cookie value. _/  
 88 +export function readCookie(name: string): string | undefined {
89 + for (const part of document.cookie.split(';')) {  
 90 + const [key, ...rest] = part.trim().split('=')  
 91 + if (key === name) {  
 92 + return decodeURIComponent(rest.join('='))  
 93 + }  
 94 + }  
 95 + return undefined  
 96 +}  
 97 +  
 98 +async function parseResponse(response: Response): Promise<unkn
+own> {  
 99 + const text = await response.text()  
 100 + let body: unknown = null  
 101 + if (text !== '') {  
 102 + try {  
 103 + body = JSON.parse(text)  
 104 + } catch {  
 105 + body = null  
 106 + }  
 107 + }  
 108 +  
 109 + if (!response.ok) {  
 110 + throw new ApiError(response.status, messageFrom(body) ?? `
          +HTTP ${response.status}`, errorsFrom(body))  
 111 + }  
 112 +  
 113 return body
114 }
115  
 116 function messageFrom(body: unknown): string | undefined {
31 - if (typeof body === 'object' && body !== null && 'message' i
-n body && typeof body.message === 'string') {  
 32 - return body.message  
 117 + return isObject(body) && isString(body.message) ? body.messa
+ge : undefined  
 118 +}  
 119 +  
 120 +function errorsFrom(body: unknown): FieldErrors {  
 121 + if (!isObject(body) || !isObject(body.errors)) {  
 122 + return {}  
 123 }
34 - return undefined  
 124 + const errors: FieldErrors = {}  
 125 + for (const [field, messages] of Object.entries(body.errors)) + {  
 126 + if (isArrayOf(messages, isString)) {  
 127 + errors[field] = messages  
 128 + }  
 129 + }  
 130 + return errors  
 131 }

● Write(frontend\src\api\auth.ts)
⎿  Wrote 80 lines to frontend\src\api\auth.ts
1 import { useMutation, useQuery, useQueryClient } from '@tanstack/
react-query'
2 import { ApiError, getJson, sendJson } from './client'
3 import { isNumber, isObject, isString } from './guards'
4
5 // POST /api/register, /api/login, /api/logout and GET /api/me (A
RCHITECTURE.md › Authentication).
6 // The signed-in state is the ['me'] query: a User, or null for a
guest. Nothing about the session is
7 // stored in JavaScript; a page reload simply asks /api/me again
… +74 lines (~2 KB) (ctrl+o to expand)

● Write(frontend\src\features\auth\safeNext.ts)
⎿  Wrote 34 lines to frontend\src\features\auth\safeNext.ts
1 // The `?next=` parameter on /login and /register: where to go a
fter signing in.
2
3 const AUTH_PAGES = new Set(['/login', '/register'])
4 // A throwaway base: anything that resolves to another origin is
not one of our pages.
5 const BASE = 'https://app.invalid'
6
7 /\*_
8 _ Returns `next` only if it is a path on this site, otherwise '
… +27 lines (ctrl+o to expand)

Searched for 1 pattern (ctrl+o to expand)

● Focus styling is global already. Now the UI components.

● Write(frontend\src\components\TextField.tsx)
⎿  Wrote 34 lines to frontend\src\components\TextField.tsx
1 import { useId, type InputHTMLAttributes } from 'react'
2
3 type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
4 label: string
5 /** A server validation message, shown under the input and ann
ounced with it. \*/
6 error?: string
7 }
8
9 /** DESIGN.md › Checkout: `text-sm` 600 label above a `field` in
… +26 lines (ctrl+o to expand)

● Write(frontend\src\features\auth\formErrors.ts)
⎿  Wrote 30 lines to frontend\src\features\auth\formErrors.ts
1 import { ApiError } from '../../api/client'
2
3 export type FormErrors = {
4 /** The first server message per field, shown under that field
. \*/
5 fields: Record<string, string>
6 /** A message for the whole form when the failure isn't about
a field (network, 500, 419…). \*/
7 form: string | null
8 }
… +22 lines (ctrl+o to expand)

● Write(frontend\src\features\auth\AuthPanel.tsx)
⎿  Wrote 46 lines to frontend\src\features\auth\AuthPanel.tsx
1 import type { FormEvent, ReactNode } from 'react'
2 import { Button } from '../../components/Button'
3 import { CONTAINER } from '../../components/Layout'
4
5 type AuthPanelProps = {
6 title: string
7 submitLabel: string
8 pending: boolean
9 formError: string | null
10 onSubmit: () => void
… +36 lines (ctrl+o to expand)

● Write(frontend\src\features\auth\LoginPage.tsx)
⎿  Wrote 63 lines to frontend\src\features\auth\LoginPage.tsx
1 import { useState } from 'react'
2 import { Link, Navigate, useSearchParams } from 'react-router'
3 import { useLogin, useMe } from '../../api/auth'
4 import { TextField } from '../../components/TextField'
5 import { AuthPanel } from './AuthPanel'
6 import { formErrors } from './formErrors'
7 import { authHref, safeNext } from './safeNext'
8
9 /\*_
10 _ /login?next=<path>. Once the user is known (signed in here, o
… +54 lines (~1 KB) (ctrl+o to expand)

● Write(frontend\src\features\auth\RegisterPage.tsx) ⎿  Wrote 73 lines to frontend\src\features\auth\RegisterPage.tsx
1 import { useState } from 'react'
2 import { Link, Navigate, useSearchParams } from 'react-router'
3 import { useMe, useRegister, type RegisterInput } from '../../api
/auth'
4 import { TextField } from '../../components/TextField'
5 import { AuthPanel } from './AuthPanel'
6 import { formErrors } from './formErrors'
7 import { authHref, safeNext } from './safeNext'
8
9 const EMPTY: RegisterInput = { name: '', email: '', password: '',
… +65 lines (~2 KB) (ctrl+o to expand)

● Write(frontend\src\features\auth\RequireAuth.tsx)
⎿  Wrote 45 lines to frontend\src\features\auth\RequireAuth.tsx
1 import { Navigate, Outlet, useLocation } from 'react-router'
2 import { useMe } from '../../api/auth'
3 import { Button } from '../../components/Button'
4 import { CONTAINER } from '../../components/Layout'
5 import { Skeleton } from '../../components/Skeleton'
6 import { authHref } from './safeNext'
7
8 /\*_
9 _ Route wrapper for signed-in pages (checkout and orders, M6).
A guest is sent to
… +36 lines (ctrl+o to expand)

● Write(frontend\src\features\auth\UserMenu.tsx)
⎿  Wrote 51 lines to frontend\src\features\auth\UserMenu.tsx
1 import { Link, useLocation, useSearchParams } from 'react-router
'
2 import { useLogout, useMe } from '../../api/auth'
3 import { Button } from '../../components/Button'
4 import { authHref } from './safeNext'
5
6 const AUTH_PAGES = new Set(['/login', '/register'])
7
8 /\*_ Header, right side (DESIGN.md › Header): the user's name and
"Sign out", or "Sign in | Register". _/
… +43 lines (ctrl+o to expand)

● Update(frontend\src\components\Layout.tsx)
⎿  Added 4 lines, removed 1 line
25 <div className="order-last w-full md:order-0 md:max-w
          -122.5 md:flex-1">
26 <SearchBox />
27 </div>
28 - {/_ The cart and user menu arrive in M5/M6. _/}  
 28 + {/_ Below md the search wraps to its own row, so this + stays top-right. The cart arrives in M6. _/}  
 29 + <div className="ml-auto">  
 30 + <UserMenu />  
 31 + </div>  
 32 </div>
33 </header>
34

● Update(frontend\src\components\Layout.tsx)
⎿  Added 1 line
1 import { Link, NavLink, Outlet, ScrollRestoration } from 'react-
router'
2 +import { UserMenu } from '../features/auth/UserMenu'  
 3 import { SearchBox } from '../features/search/SearchBox'
4  
 5 /\*_ Content column: 1072px max (DESIGN.md › Spacing), 16px gutte
r below 768px, 24px from 768px. _/

● Write(frontend\src\routes.tsx)
⎿  Added 6 lines
1 import type { RouteObject } from 'react-router'
2 import { Layout } from './components/Layout'
3 +import { LoginPage } from './features/auth/LoginPage'  
 4 +import { RegisterPage } from './features/auth/RegisterPage'  
 5 import { HomePage } from './features/home/HomePage'
6 import { ProductPage } from './features/product/ProductPage'
7 import { StorePage } from './features/store/StorePage'
8 import { NotFoundPage } from './pages/NotFoundPage'
9  
 10 +// Signed-in pages (checkout, orders) go under a `{ element: <R
         +equireAuth />, children: [...] }`  
 11 +// route in M6.  
 12 export const routes: RouteObject[] = [
13 {
14 element: <Layout />,
...
16 { path: '/', element: <HomePage /> },
17 { path: '/store', element: <StorePage /> },
18 { path: '/product/:slug', element: <ProductPage /> },
19 + { path: '/login', element: <LoginPage /> },
 20 + { path: '/register', element: <RegisterPage /> },
 21 { path: '*', element: <NotFoundPage /> },
22 ],
23 },

Ran 1 shell command (ctrl+o to expand)

● Typecheck and lint pass. Now the Vitest tests, with a small shared
fetch-routing stub.

● Write(frontend\src\test\fetchRoutes.ts)
⎿  Wrote 45 lines to frontend\src\test\fetchRoutes.ts
1 import { vi } from 'vitest'
2
3 // Test helpers for code that calls fetch(): route stubs by "MET
HOD /path" and cookie cleanup.
4
5 type Handler = (init: RequestInit | undefined) => Response | Pro
mise<Response>
6
7 export function json(status: number, body?: unknown): Response {
8 return new Response(body === undefined ? null : JSON.stringify
… +38 lines (~1 KB) (ctrl+o to expand)

● Write(frontend\src\api\client.test.ts)
⎿  Wrote 99 lines to frontend\src\api\client.test.ts
1 import { afterEach, beforeEach, describe, expect, it, vi } from '
vitest'
2 import { clearCookies, headersOf, json, stubRoutes } from '../tes
t/fetchRoutes'
3 import { ApiError, readCookie, sendJson } from './client'
4
5 beforeEach(() => clearCookies())
6 afterEach(() => {
7 vi.unstubAllGlobals()
8 clearCookies()
… +91 lines (ctrl+o to expand)

● Write(frontend\src\features\auth\safeNext.test.ts)
⎿  Wrote 42 lines to frontend\src\features\auth\safeNext.test.ts
1 import { describe, expect, it } from 'vitest'
2 import { authHref, safeNext } from './safeNext'
3
4 describe('safeNext', () => {
5 it.each([
6 ['/store', '/store'],
7 ['/store?platform[]=steam&sort=price_asc', '/store?platform[
]=steam&sort=price_asc'],
8 ['/product/elden-ring-steam-global#offers', '/product/elden-
ring-steam-global#offers'],
… +34 lines (ctrl+o to expand)

● Write(frontend\src\features\auth\auth.test.tsx)
⎿  Wrote 193 lines to frontend\src\features\auth\auth.test.tsx
1 import { QueryClient, QueryClientProvider } from '@tanstack/reac
t-query'
2 import { fireEvent, render, screen } from '@testing-library/reac
t'
3 import { createMemoryRouter, RouterProvider, useLocation, type R
outeObject } from 'react-router'
4 import { afterEach, beforeEach, describe, expect, it, vi } from
'vitest'
5 import type { User } from '../../api/auth'
6 import { clearCookies, json, stubRoutes } from '../../test/fetch
… +188 lines (~7 KB) (ctrl+o to expand)

Ran 1 shell command (ctrl+o to expand)

● Every suite fails at setup.ts, even the untouched ones, which points to the
environment (a duplicate Vitest instance from drive-letter casing under Git
Bash) rather than the code. I'm rerunning the same tests from PowerShell next.
· summary

Ran 1 shell command (ctrl+o to expand)

● All 101 pass from PowerShell (65 existing + 36 new); the Git Bash failure was
the drive-letter path issue. Build next, from PowerShell too.

Ran 1 shell command (ctrl+o to expand)

● Everything is green. Now an end-to-end check against real servers: artisan
serve plus Vite, with curl acting as the browser through the proxy.

Ran 3 shell commands (ctrl+o to expand)

● The login flow checks out through the Vite proxy: CSRF is enforced, wrong
passwords return a field error, sessions persist on reload and end on logout,
and the cookie is httponly and samesite=lax. I'm stopping the dev servers
next. · summary

Ran 1 shell command (ctrl+o to expand)

● Servers stopped. Now the docs: ARCHITECTURE.md, CLAUDE.md and PLAN.md.

● Update(docs\ARCHITECTURE.md)
⎿  Added 30 lines, removed 5 lines
287  
 288 ## Authentication
289  
 290 -- Sanctum **SPA mode** with a session cookie (`httpOnly`, `Sec
          -ure`, `SameSite=Lax`) set on the Vercel origin through the rew
-rite. No token is stored in JavaScript.  
 291 -- Login and register first call `GET /sanctum/csrf-cookie`. Th
-e fetch client then sends `X-XSRF-TOKEN` (read from the `XSRF-
          -TOKEN` cookie) on every request that changes state.  
 292 -- `SANCTUM_STATEFUL_DOMAINS=<app>.vercel.app,localhost:5173`. -`TrustProxies` trusts all proxies (Vercel → Render's load bala
-ncer), so the scheme and host are detected correctly.  
 293 -- Rate limiting: login is limited to 5 attempts per minute per - email+IP (Laravel's built-in limiter).  
 294 -- Frontend: a `RequireAuth` route wrapper checks `/api/me` thr
-ough TanStack Query. If the user isn't signed in, it redirects - to `/login?next=<path>`.  
 290 +- Sanctum **SPA mode** with a session cookie (`httpOnly`, `Sec
          +ure`, `SameSite=Lax`) set on the Vercel origin through the rew
+rite. No token is stored in JavaScript. Sanctum's API tokens a
+re not used: the frontend and backend are on different hosts,
+but the browser only ever sees the Vercel origin, so the cooki
+e is first-party.  
 291 +- **CSRF.** Before its first state-changing request, `sendJson
          +` in `src/api/client.ts` calls `GET /sanctum/csrf-cookie` if t
+here is no `XSRF-TOKEN` cookie. It then sends that cookie's va
+lue as `X-XSRF-TOKEN`. On a 419 (the token expired with the se
+ssion) it fetches a new cookie and retries once.  
 292 +- **Stateful domains.** `SANCTUM_STATEFUL_DOMAINS` defaults to + `localhost:5173` in `config/sanctum.php`. The `Dockerfile` se
+ts it to the Vercel host. `TrustProxies` trusts all proxies (V
+ercel → Render's load balancer), so the scheme and host are de
+tected correctly.  
 293 +- **Sign-in.**  
 294 + - Emails are lower-cased and trimmed.  
 295 + - A failed sign-in returns 422 with the same message for an
+unknown email and a wrong password.  
 296 + - After 5 failures a minute per email+IP, sign-in returns 42
+9 with the message on the `email` field, even for the right pa
+ssword.  
 297 + - A successful sign-in regenerates the session id.  
 298 + - Logout invalidates the session on the server.  
 299 + - Passwords are bcrypt-hashed by the `hashed` cast on `User`
+.  
 300 +- **CORS is closed.** `config/cors.php` has `allowed_origins =
          +> []` and `supports_credentials => false`, so no origin gets a
+n `Access-Control-Allow-Origin` header, preflights included. L
+aravel's unpublished default allowed every origin on `api/*`.
+It was live from M0 to M5 without anyone choosing it. The SPA
+never needs CORS, because it is same-origin through the Vercel + rewrite and the Vite proxy.  
 301 +- **Frontend.**  
 302 + - The signed-in state is the TanStack Query `['me']` query:
+a user, or `null` (a 401 from `/api/me` is an answer, not an e
+rror).  
 303 + - `RequireAuth` (`features/auth/`) redirects a guest to `/lo
          +gin?next=<path>`.  
 304 + - The header's "Sign in | Register" links carry `next` too.
305 + - `safeNext` accepts only a path on this site, which blocks
+open redirects such as `//evil.com`.  
 306  
 307 +**Where the credential lives, and the trade-off.** The credent
+ial is the Laravel session cookie. It is `httpOnly`, so JavaSc
+ript can't read it, and the session row lives in Postgres. Not
+hing is kept in localStorage or React state. On a reload, the
+SPA asks `/api/me` and the browser attaches the cookie. The on
+ly cookie JavaScript reads is `XSRF-TOKEN`, and it is not a cr
+edential.  
 308 +  
 309 +What this gains, compared with a bearer token in localStorage:
310 +- An XSS bug can't read the credential and take it away.  
 311 +- Logout ends the session on the server.  
 312 +- The client has no token to refresh or rotate.  
 313 +  
 314 +What it costs:  
 315 +- CSRF has to be handled: the cookie round trip, the header an
+d the 419 retry. `SameSite=Lax` is a second layer.  
 316 +- It works only while the API is same-origin. Calling Render d
+irectly from the browser would break it.  
 317 +- Every authenticated request reads a session row.  
 318 +- Non-browser clients would need tokens.  
 319 +- An XSS can still send requests _as_ the user while the page
+is open. It just can't keep the credential.  
 320 +  
 321 ## Deployment
322  
 323 | Piece | Setup |

● Update(docs\ARCHITECTURE.md)
⎿  Added 1 line, removed 1 line
323 | Piece | Setup |
324 |---|---|
325 | **Neon** | Free project with Postgres 16 in AWS Frankfurt (`
           aws-eu-central-1`, next to Render; the region can't be changed
later). Branches: `main` (production), `dev` (local app) and
`test` (local test suite, wiped by tests). `pg_trgm` 1.6 is av
ailable; `CREATE EXTENSION pg_trgm` runs in a migration. The a
pp uses the **direct (non-pooled)** connection string with `ss
           lmode=require`. At this traffic level pooling isn't needed, an
d the direct connection avoids PgBouncer issues with prepared
statements. Free computes suspend after 5 minutes idle. |
326 -| **Render** | Free web service in Frankfurt, built from `back
          -end/Dockerfile` (based on `serversideup/php:8.4-fpm-nginx`, ng
-inx on port 8080). There is no custom entrypoint: the image's
-Laravel automations (`AUTORUN_ENABLED=true`) run `migrate --fo
          -rce --seed` (waiting up to 60 s for the database) and `optimiz
          -e` on every container start. `AUTORUN_LARAVEL_MIGRATION_SEED=t
          -rue` adds `--seed`. The seeder fills an empty database on the
-first deploy and skips once products exist, because Render fre
-e has no shell and no pre-deploy hook. Non-secret defaults (`A
          -PP_ENV=production`, `APP_DEBUG=false`, `LOG_CHANNEL=stderr`, `
          -DB_CONNECTION=pgsql`, `SESSION_DRIVER=database`, `CACHE_STORE=
          -database`) are baked into the image. Dashboard env: `APP_KEY`, - `APP_URL`, `DB_URL`, `SESSION_SECURE_COOKIE=true`, `PORT=8080
          -`, and `SANCTUM_STATEFUL_DOMAINS` from M5. |  
 326 +| **Render** | Free web service in Frankfurt, built from `back
          +end/Dockerfile` (based on `serversideup/php:8.4-fpm-nginx`, ng
+inx on port 8080). There is no custom entrypoint: the image's
+Laravel automations (`AUTORUN_ENABLED=true`) run `migrate --fo
          +rce --seed` (waiting up to 60 s for the database) and `optimiz
          +e` on every container start. `AUTORUN_LARAVEL_MIGRATION_SEED=t
          +rue` adds `--seed`. The seeder fills an empty database on the
+first deploy and skips once products exist, because Render fre
+e has no shell and no pre-deploy hook. Non-secret defaults (`A
          +PP_ENV=production`, `APP_DEBUG=false`, `LOG_CHANNEL=stderr`, `
          +DB_CONNECTION=pgsql`, `SESSION_DRIVER=database`, `CACHE_STORE=
          +database`, and `SANCTUM_STATEFUL_DOMAINS=<app>.vercel.app` fro
+m M5) are baked into the image. Dashboard env: `APP_KEY`, `APP
          +_URL`, `DB_URL`, `SESSION_SECURE_COOKIE=true`, `PORT=8080`. |
327 | **Vercel** | Project root `frontend/`, build `npm run build`
, output `dist/`. `vercel.json` is shown below. |
328 | **Keep-warm** | Render free sleeps after 15 minutes idle, an
d a cold start takes about a minute. Vercel waits up to 120 s
for an external rewrite, so the first request is slow rather t
han failing. A free cron-job.org job hitting `https://<app>.ve
           rcel.app/api/health` every 10 minutes avoids the wait (deferre
d from M0). One always-on service uses about 744 of Render's 7
50 free hours a month. |
329 | **Local dev** | No Docker: `backend/.env` points at the Neon
`dev` branch and `backend/.env.testing` at `test`. `php artis
           an serve`, `npm run dev`. The Vite dev server proxies `/api` a
nd `/sanctum` to `localhost:8000`, which mirrors the single or
igin used in production. |

● Update(docs\ARCHITECTURE.md)
⎿  Added 1 line, removed 1 line
24 └──────────────────────────────┘ └───────
────────────────┘
25 ```
26  
 27 -The browser only ever talks to the Vercel origin, and Vercel pr
-oxies API calls to Render. So the session cookie is first-party
-, Sanctum's cookie-based SPA auth works, and no CORS setup is n
-eeded.  
 27 +The browser only ever talks to the Vercel origin, and Vercel pr
+oxies API calls to Render. So the session cookie is first-party
+, Sanctum's cookie-based SPA auth works, and CORS stays closed
+(see [Authentication](#authentication)).  
 28  
 29 ## Repository layout
30

Ran 1 shell command (ctrl+o to expand)

● Update(CLAUDE.md)
⎿  Added 1 line, removed 1 line
31 Playwright is added in M9.
32  
 33 ### Deploy
34 -Merging to `main` deploys both apps: Vercel builds `frontend/`, - and Render builds `backend/Dockerfile` and runs `migrate --for
         -ce --seed` and `optimize` on every container start (Render free - has no shell). The seeder only fills an empty database: it ski
-ps once products exist, so it never overwrites production data. - To reseed production, empty the tables in the Neon console and - restart the service. Demo login: `demo@example.com` / `passwor
         -d`. The frontend has no env vars. Render's env (names only): `A
         -PP_KEY`, `APP_URL`, `DB_URL` (Neon `main`, direct), `SESSION_SE
         -CURE_COOKIE`, `PORT=8080`; everything else is baked into the im
-age.  
 34 +Merging to `main` deploys both apps: Vercel builds `frontend/`, + and Render builds `backend/Dockerfile` and runs `migrate --for
         +ce --seed` and `optimize` on every container start (Render free + has no shell). The seeder only fills an empty database: it ski
+ps once products exist, so it never overwrites production data. + To reseed production, empty the tables in the Neon console and + restart the service. Demo login: `demo@example.com` / `passwor
         +d`. The frontend has no env vars. Render's env (names only): `A
         +PP_KEY`, `APP_URL`, `DB_URL` (Neon `main`, direct), `SESSION_SE
         +CURE_COOKIE`, `PORT=8080`; everything else is baked into the im
+age, including `SANCTUM_STATEFUL_DOMAINS` (the Vercel host; cha
+nge it in the `Dockerfile` if the Vercel URL changes).  
 35 `sh
      36  curl -i https://eneba-marketplace-rosy.vercel.app/api/health   
           # production smoke check through Vercel; expect 200 {"status":
          "ok","db":"ok"}
      37  `
● Update(docs\PLAN.md)
⎿  Added 34 lines, removed 4 lines
119  
 120 ## M5 — Authentication
121  
 122 -- [ ] Sanctum SPA setup: stateful domains, TrustProxies, datab
-ase sessions and the CSRF cookie flow in the fetch client.  
 123 -- [ ] Close CORS explicitly: publish `config/cors.php` with `a
          -llowed_origins => []` and `supports_credentials => false`. The - SPA is same-origin through the Vercel rewrite and the Vite pr
-oxy, so it never needs CORS. Laravel's unpublished default (`a
          -llowed_origins => ['*']` on `api/*`) is live since M0 and was
-never a decision. Note it in ARCHITECTURE.md › Authentication.
124 -- [ ] `POST /api/register`, `/api/login` (rate-limited), `/api
          -/logout` and `GET /api/me`.  
 125 -- [ ] Login and register pages with server validation errors s
-hown on the fields. `RequireAuth` wrapper with `?next=` redire
-ct back. Header shows the user menu or a sign-in link.  
 122 +- [x] Sanctum SPA setup: stateful domains, TrustProxies, datab
+ase sessions and the CSRF cookie flow in the fetch client.  
 123 +- [x] Close CORS explicitly: publish `config/cors.php` with `a
          +llowed_origins => []` and `supports_credentials => false`. The + SPA is same-origin through the Vercel rewrite and the Vite pr
+oxy, so it never needs CORS. Laravel's unpublished default (`a
          +llowed_origins => ['*']` on `api/*`) is live since M0 and was
+never a decision. Note it in ARCHITECTURE.md › Authentication.
124 +- [x] `POST /api/register`, `/api/login` (rate-limited), `/api
          +/logout` and `GET /api/me`.  
 125 +- [x] Login and register pages with server validation errors s
+hown on the fields. `RequireAuth` wrapper with `?next=` redire
+ct back. Header shows the user menu or a sign-in link.  
 126  
 127 **Verify:** Pest tests: register, login with valid and invalid
credentials, logout, the throttle after 5 failures, and a gue
st getting 401 on `/api/checkout`, `/api/orders` and `/api/me`
. A request with a foreign `Origin` (including a preflight `OP
           TIONS`) gets no `Access-Control-Allow-Origin` header. **Produc
tion check:** sign in on the Vercel URL, reload the page and s
tay signed in. This confirms the cookie survives the proxy.
128  
 129 +**Verified 2026-11-15** (except the production check, which wa
+its for the merge):  
 130 +- **Automated:**  
 131 + - Pest 149/149 on the `test` branch, and Pint is clean.  
 132 + - `AuthTest` (18 tests):  
 133 + - Register stores only a bcrypt hash and signs the user in
+. Five invalid-input cases each return 422 on the right field.
134 + - Valid login. A wrong password and an unknown email retur
+n the same 422.  
 135 + - The 6th try after 5 failures returns 429, even with the
+right password. A success resets the count.  
 136 + - Sign-in gives a new session id.  
 137 + - Logout invalidates the session: the old cookie then gets + 401.  
 138 + - Every `auth:sanctum` route returns 401 JSON to a guest.
139 + - `/sanctum/csrf-cookie` sets `XSRF-TOKEN`.  
 140 + - A foreign `Origin` (GET and preflight) gets no `Access-C
          +ontrol-Allow-Origin` header.  
 141 + - The follow-up requests drop the test app's cached guards + and carry only the session cookie, like a page reload.  
 142 + - Vitest 101/101:  
 143 + - `client`: `X-XSRF-TOKEN`, fetching the cookie when it's
+missing, one retry on 419, field errors.  
 144 + - `safeNext`: open-redirect cases.  
 145 + - `RequireAuth`: redirect with `next`, the signed-in page, + the API down.  
 146 + - `LoginPage` / `RegisterPage`: errors on the fields with +`aria-describedby`; going back to `next`.  
 147 + - `UserMenu`: links with `next`, sign out.  
 148 + - oxlint, `tsc -b` and the build pass.  
 149 +- **Manual, through the Vite proxy (curl standing in for the b
+rowser):**  
 150 + - A POST without `X-XSRF-TOKEN` gets 419. A wrong password g
+ets 422.  
 151 + - Login gives 200, and the session cookie is `httponly; same
          +site=lax`. `Secure` comes from `SESSION_SECURE_COOKIE` on Rend
+er.  
 152 + - `/api/me` with only the cookie (a reload) gets 200.  
 153 + - Logout gets 204, and `/api/me` then gets 401.  
 154 +- **Changes from the plan:**  
 155 + - The guest-401 test walks every route in the `auth:sanctum` + group instead of naming `/api/checkout` and `/api/orders`, wh
+ich don't exist until M6. It covers `/api/me` and `/api/logout
          +` now and picks up the M6 routes automatically.  
 156 + - `SANCTUM_STATEFUL_DOMAINS` is set in the `Dockerfile`, not + the Render dashboard.  
 157 + - `RequireAuth` isn't mounted on a page yet: M6 puts it arou
+nd checkout and orders.  
 158 +  
 159 ## M6 — Cart and checkout
160  
 161 - [ ] Cart store (localStorage, `{offerId, quantity}` only): a
dd, merge duplicate offers, set quantity, remove, clear, and a
count badge in the header.

● Saving the Git Bash/Vitest quirk to memory, since it'll bite again:

Ran 1 shell command, wrote 1 memory (ctrl+o to expand)

● Sign-up, sign-in and sign-out work, and refreshing the page keeps you signed
in. Checkout and order history are set up to need sign-in, and after signing
in you go back to the page you came from. Everything is on branch
feat/m5-auth, which I made from feat/m7-homepage because M7 isn't on main yet.
Nothing is committed.

Checks: backend tests 149/149, Pint clean, frontend tests 101/101, lint,
type-check and build all pass. I also ran the real flow through the dev proxy
with curl standing in for the browser:

- a POST without the CSRF header gets 419
- a wrong password gets 422
- login works, and a "reload" that sends only the cookie stays signed in
- after logout the old cookie gets 401

Your "done when" items:

- Register: tested, including that only a password hash is stored and five
  invalid-input cases that each return an error on the right field.
- Wrong password: returns 422 with the same message as an unknown email, so
  the form doesn't reveal which emails have accounts. After 5 failures in a
  minute it returns 429.
- Protected endpoint without sign-in: the test checks every sign-in-only route
  and expects 401. It covers /api/me and /api/logout now, and will pick up
  checkout and orders when M6 adds them.
- Refresh keeps you signed in: a test sends a second request carrying only the
  session cookie, the same as a page reload.

Where the credential is stored on the frontend, and the trade-off. As you
chose, it uses the session cookie, not an API token. The frontend stores no
token at all:

- The credential is Laravel's session cookie. It is httpOnly, so JavaScript
  can't read it, and the session itself is kept in Postgres. Nothing is in
  localStorage or React state.
- The only cookie JavaScript reads is XSRF-TOKEN. It isn't a credential:
  client.ts (frontend/src/api/client.ts) sends it back as the X-XSRF-TOKEN
  header to prove the request came from our own page.
- On a reload, the app calls /api/me and the browser attaches the cookie
  automatically.

What this gains over a token in localStorage:

- A cross-site scripting (XSS) bug can't steal the credential.
- Logout actually ends the session on the server.
- There's no token to refresh or rotate.

What it costs:

- CSRF has to be handled: one extra request to get the cookie, the header on
  every change, and one retry if the token expires.
- It only works because the browser sees one domain: Vercel forwards /api to
  Render. Calling Render directly from the browser would break it.
- Each signed-in request does a session lookup in the database.
- An XSS bug can still send requests as the user while the page is open; it
  just can't take the credential away.

Other changes:

- laravel/sanctum was added as the approved dependency.
- CORS is now closed. Laravel's default had been allowing any origin since M0,
  and the app never needs CORS.
- The ?next= value only accepts paths on this site, so it can't be used to
  redirect someone to another website.
- Production's allowed domain (SANCTUM_STATEFUL_DOMAINS) is set in the
  Dockerfile instead of the Render dashboard, so there's nothing to set by
  hand. If the Vercel URL changes, it has to change there.
- The sign-in check that protects pages isn't on any page yet. M6 puts it
  around checkout and orders.
- ARCHITECTURE.md › Authentication, CLAUDE.md and PLAN.md are updated, with
  the M5 boxes ticked and a "Verified" note.

Still to do:

- Production check after merge: sign in on
  https://eneba-marketplace-rosy.vercel.app, reload, and you should stay
  signed in.
- Your local .env: it doesn't need the new variable, because the default
  already allows localhost:5173.
- Frontend tests on this machine: they fail under Git Bash and pass from
  PowerShell. I saved that to memory.

Say when you want it committed.
