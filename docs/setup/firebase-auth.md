# Firebase Authentication setup

Used by `GET /api/me` and watchlist routes (`Authorization: Bearer <ID token>`).

## Enable providers

1. Firebase Console → Authentication → Sign-in method.
2. Enable **Email/Password** and/or **Google** (match your client app).
3. Add authorized domains for your web app and API host if needed.

## Client config

Clients use the Firebase **web** config (`apiKey`, `authDomain`, `projectId`, …).
Never put the Admin private key in the client.

## API env

| Variable | Notes |
|----------|-------|
| `AUTH_ENABLED` | `true` in production; `false` only for local bypass (`DEV_AUTH_USER`) |
| `FIREBASE_*` | Same Admin credentials as Firestore |

When `AUTH_ENABLED=false` and `NODE_ENV=production`, the API refuses to start protected routes
(returns internal error on auth).

## Verify

```bash
curl -s https://YOUR_API/api/me          # → 401 UNAUTHENTICATED
curl -s -H "Authorization: Bearer $ID_TOKEN" https://YOUR_API/api/me  # → 200 AuthUser
```
