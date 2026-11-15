<?php

namespace App\Services\Auth;

use App\Models\User;
use Illuminate\Contracts\Session\Session;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

/**
 * Session (cookie) authentication for the SPA. The session lives in the `sessions` table and the
 * browser holds only the httpOnly session cookie, so no credential is ever readable from JavaScript.
 */
final class AuthService
{
    public const MAX_LOGIN_ATTEMPTS = 5;

    public const LOCKOUT_SECONDS = 60;

    /** @param array{name: string, email: string, password: string} $data */
    public function register(array $data, Session $session): User
    {
        // The `hashed` cast on User::password stores a bcrypt hash, never the plain text.
        $user = User::create($data);

        Auth::guard('web')->login($user);
        $session->regenerate();

        return $user;
    }

    /**
     * Unknown email and wrong password give the same message, so the form doesn't reveal which
     * emails have accounts. After MAX_LOGIN_ATTEMPTS failures the email+IP pair is locked out
     * (429) even for the right password, until the window passes.
     *
     * @throws ValidationException
     */
    public function login(string $email, string $password, string $throttleKey, Session $session): User
    {
        if (RateLimiter::tooManyAttempts($throttleKey, self::MAX_LOGIN_ATTEMPTS)) {
            $seconds = RateLimiter::availableIn($throttleKey);

            throw ValidationException::withMessages([
                'email' => "Too many sign-in attempts. Try again in {$seconds} seconds.",
            ])->status(429);
        }

        if (! Auth::guard('web')->attempt(['email' => $email, 'password' => $password])) {
            RateLimiter::hit($throttleKey, self::LOCKOUT_SECONDS);

            throw ValidationException::withMessages([
                'email' => 'These credentials do not match our records.',
            ]);
        }

        RateLimiter::clear($throttleKey);
        // A new session id on sign-in prevents session fixation.
        $session->regenerate();

        /** @var User */
        return Auth::guard('web')->user();
    }

    public function logout(Session $session): void
    {
        Auth::guard('web')->logout();
        $session->invalidate();
        $session->regenerateToken();
    }
}
