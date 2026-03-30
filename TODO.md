# TODO

## OAuth — убрать заглушки и настроить credentials

Сейчас в стратегиях стоят заглушки `'not-configured'` вместо реальных ключей.
Пока OAuth не работает — кнопки входа через GitHub/Google/Yandex будут падать с ошибкой.

Что сделать:

1. Зарегистрировать OAuth-приложения в нужных сервисах
2. Заполнить в `.env`:

   ```
   GITHUB_CLIENT_ID=
   GITHUB_CLIENT_SECRET=

   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=

   YANDEX_CLIENT_ID=
   YANDEX_CLIENT_SECRET=
   ```

3. Убрать fallback `|| 'not-configured'` в стратегиях:
   - `libs/backend/auth/src/strategies/github.strategy.ts`
   - `libs/backend/auth/src/strategies/google.strategy.ts`
   - `libs/backend/auth/src/strategies/yandex.strategy.ts`
