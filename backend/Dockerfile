FROM serversideup/php:8.4-fpm-nginx

# Non-secret production defaults. Secrets (APP_KEY, DB_URL) and APP_URL come from the Render dashboard.
# The image's Laravel automations run on every container start, before nginx starts:
# storage:link (off: no public disk), migrate --force (waits for the DB), then optimize (caches config with runtime env).
# Seeding stays off until M1 ships an idempotent seeder.
ENV APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr \
    DB_CONNECTION=pgsql \
    SESSION_DRIVER=database \
    CACHE_STORE=database \
    QUEUE_CONNECTION=sync \
    PHP_OPCACHE_ENABLE=1 \
    AUTORUN_ENABLED=true \
    AUTORUN_LARAVEL_STORAGE_LINK=false \
    AUTORUN_LARAVEL_MIGRATION_TIMEOUT=60 \
    COMPOSER_ALLOW_SUPERUSER=1

USER root
WORKDIR /var/www/html
COPY . /var/www/html
RUN composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader \
    && chown -R www-data:www-data /var/www/html
USER www-data

# nginx listens on 8080 (set PORT=8080 on Render).
EXPOSE 8080
