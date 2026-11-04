# Phase 4: auth, user and capabilities

## What changed

| Area | Behaviour |
| --- | --- |
| `GET /api/auth/me`, `POST /api/auth/refresh` | Both return `{ user: { id, email, name, username, image, role } }`. |
| `GET /api/auth/google/start?returnTo=` | Validates `returnTo` (internal paths under `/dashboard`, `/visualizer`, `/algorithms`, `/s`, `/terms`, `/privacy`, or `/`), stores it in a short-lived httpOnly cookie, redirects to Google. Anything unsafe becomes `/dashboard`. |
| `GET /api/auth/google/callback` | Validates the stored path again and redirects to `WEB_APP_URL + path`. A failure redirects to the same path with `?authError=oauth_failed`; pressing Cancel on Google's screen gives `?authError=oauth_denied`. |
| `GET /api/auth/sessions`, `DELETE /api/auth/sessions/:id` | List and sign out devices. Revoking the current device also clears this browser's cookies. |
| `PATCH /api/users/me` | Update `name` and/or `username` (3-30 chars: lowercase letters, digits, `_`; reserved names refused; unique). |
| `DELETE /api/users/me` | Deletes the account. The database cascades to accounts, sessions, analyses and chat sessions. The only remaining admin cannot delete themselves. Cached public chat links are purged. |
| `GET /api/meta/capabilities` | `{ analysis, assistant, sharing, savedWork, limits }`. `analysis`/`assistant`/`sharing` are true when an AI provider is configured; `savedWork` stays false until Phase 6. |
| Session activity | `Session.lastUsedAt` is written at most every `SESSION_LAST_USED_THROTTLE_MINUTES` (default 5), with the condition inside the SQL `UPDATE`. |
| Session cleanup | A timer deletes expired sessions and revoked sessions older than `SESSION_REVOKED_RETENTION_DAYS` (default 7). |
| Database | `users.last_login_at`, `sessions.created_at`, indexes on `sessions(rotated_from_id)` and `sessions(expires_at)`. Migration `*_phase4_auth_sessions` is additive. |

New environment variables (all optional, shown with defaults). Add them to your own env files; the script never edits `.env`:

```
SESSION_LAST_USED_THROTTLE_MINUTES=5
SESSION_CLEANUP_ENABLED=true
SESSION_CLEANUP_INTERVAL_MINUTES=60
SESSION_REVOKED_RETENTION_DAYS=7
```

## Deployment strategy: same origin (decision D4)

The browser only talks to the web origin. Next.js forwards `/api/*` to the API (`apps/web/next.config.ts`).
Cookies are then first-party and host-only, CORS is not involved, and `SameSite=Lax` cookies are always sent.

| Where | Setting | Value |
| --- | --- | --- |
| web build and runtime | `API_URL` | Internal address of the API, e.g. `http://api:4000`. Unset in development means `http://localhost:4000`. In production, unset means **no proxy** (a warning is printed). It is read when `next build` runs. |
| web | `NEXT_PUBLIC_API_URL` | Leave **empty**. The frontend then calls `/api/...` on its own origin. |
| api | `WEB_APP_URL` | The public web origin, e.g. `https://app.example.com`. Used for redirects after sign-in. |
| api | `API_BASE_URL` | Production: set to the **same public web origin** (`https://app.example.com`). Google then redirects to `https://app.example.com/api/auth/google/callback`, which Next proxies to the API, so every cookie is first-party. Development: leave unset (`http://localhost:4000`). |
| api | `COOKIE_DOMAIN` | Leave **unset** for same origin (host-only cookies). Set it (for example `.example.com`) only if the web app and API must live on different subdomains. |
| api | `NODE_ENV` | `production` turns on the `Secure` flag on every cookie. Serve everything over HTTPS. |
| api | `trust proxy` | Already `1`. Keep exactly one proxy hop in front of the API, or rate limits and session IPs will be wrong. |

### Cookies

| Cookie | httpOnly | Path | Lifetime | Purpose |
| --- | --- | --- | --- | --- |
| `af_access` | yes | `/` | `ACCESS_TOKEN_TTL_MINUTES` | Access token. |
| `af_refresh` | yes | `/api/auth` | `REFRESH_TOKEN_TTL_DAYS` | Refresh token (rotated on every refresh). |
| `af_csrf` | **no** | `/` | `REFRESH_TOKEN_TTL_DAYS` | Double-submit CSRF token, read by the web app and sent as `X-CSRF-Token`. |
| `af_oauth_state` | yes | `/api/auth/google` | 10 minutes | OAuth state. |
| `af_return_to` | yes | `/api/auth/google` | 10 minutes | Validated return path. |

All are `SameSite=Lax`. `Secure` follows `NODE_ENV=production`. `domain` is only sent when `COOKIE_DOMAIN` is set.

| | Development | Production |
| --- | --- | --- |
| Web | `http://localhost:3000` | `https://app.example.com` |
| API | `http://localhost:4000` (proxied through `/api/*`) | internal, behind the web origin |
| `Secure` | off | on |
| `COOKIE_DOMAIN` | unset | unset |
| Google redirect URI | `http://localhost:4000/api/auth/google/callback` | `https://app.example.com/api/auth/google/callback` |

`localhost` cookies are shared across ports, which hides cookie problems in development. Test the whole sign-in flow on a staging domain over HTTPS before releasing.

### Google Cloud console

Register one authorized redirect URI per environment, exactly matching `API_BASE_URL + /api/auth/google/callback`.

## Rolling out the migration

```
pnpm db:migrate:deploy      # production / CI
pnpm db:migrate:dev         # local development
```

Rollback (manual, see the comment at the top of `migration.sql`): drop the two indexes, then the two columns. Nothing reads the new columns except the code in this phase, so rolling back the code first is safe.

## Frontend behaviour

* `AuthProvider` loads `/api/auth/me`. A 401 means guest, not an error. Cookies are httpOnly, so the browser cannot forge a signed-in state.
* `login(returnTo?)` navigates the whole page to `/api/auth/google/start`. `logout()` and `logoutAll()` call the API and clear private cached data.
* Guests can use the dashboard editor and the visualizer. Analysis, history, the AI assistant and sharing show an inline sign-in prompt.
* `GET /api/meta/capabilities` decides whether a feature exists. `MOCK_DATA_ENABLED` now only controls development sample content.
