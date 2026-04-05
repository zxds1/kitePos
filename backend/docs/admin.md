# Backend Admin Configuration

## Admin UI exposure

The backend must allow the admin UI origin through CORS. Set these environment variables in `backend/.env.prod`:

- `ADMIN_CORS` — trusted admin UI domains
- `AUTH_CORS` — domains allowed for auth callbacks
- `STORE_CORS` — storefront domains
- `ADMIN_URL` — the admin UI base URL

Example production settings:

```env
ADMIN_CORS=https://admin.example.com
AUTH_CORS=https://admin.example.com
STORE_CORS=https://store.example.com
ADMIN_URL=https://admin.example.com
```

## Admin route proxying

The Nginx proxy forwards `/admin` traffic to the active backend service. Make sure your public domain points to the VPS host and the backend is reachable on port `9000`.

## Recommended setup

- Use a dedicated host name for your admin UI, such as `admin.example.com`.
- Keep `ADMIN_CORS` and `AUTH_CORS` locked to only approved domains.
- If you use a separate admin front-end, point it to the backend API host via environment variables.

## Security reminders

- Do not expose `JWT_SECRET`, `COOKIE_SECRET`, or `HASH_SALT` in public repositories.
- Use HTTPS in production.
- Keep admin credentials and API keys in secret storage.
