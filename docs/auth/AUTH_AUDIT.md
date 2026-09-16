# Auth audit — 2026-09-16

Audit performed before implementation against the existing workspace (no Git metadata present).

| Area | Existing implementation and reuse decision |
| --- | --- |
| Login UI | `AuthForm` in login mode: `email`, `password`, `remember`; forgot-password and social buttons are placeholders. Keep layout, fields, CSS, validation, and notices. |
| Register UI | Same `AuthForm`: `fullName`, `email`, `password`, `confirmPassword`, `terms`. Keep confirmation and consent client-side. |
| Validation | `features/auth/schemas/authValidation.js`, including password strength; reuse and add length bounds in this file only. |
| authApi | Login posts email/password; register previously also sent confirmPassword; getMe points to `/api/v1/users/me`. All methods resolve the standard envelope using the one Axios client. Remove confirmPassword from the transmitted registration DTO. |
| AuthContext | `user`, `isAuthenticated`, `isLoading`, `establishSession`, `logout`; previously derived user/role only from decoded JWT. Preserve API and add login/register, authoritative `/me` restoration, currentUser alias, loading/error/retry. |
| Storage | `storage.js` uses sessionStorage; `tokenUtils.js` provides in-memory fallback, expiry/decoding, and auth change events. Persist only access token through these helpers. |
| Errors | Axios already normalizes errors and clears only the matching token on 401, protecting a newer session from late responses. Reuse unchanged. |
| JWT | Existing HS256 `JwtTokenProvider`, environment secret, issuer, subject, issuedAt, expiration, tokenType=access, singular role. Add plural roles and immutable database ID subject; keep singular role for Gateway/other services and the existing issuance overload. |
| Security | Auth stateless security already permits only POST register/login and health, protects other routes, uses BCrypt and method security. Preserve rules and generic UNAUTHORIZED/FORBIDDEN contracts. |
| User lookup | CustomUserDetailsService had an optional UserLookup placeholder that always failed closed without an adapter. Replace internals with auth-local UserRepository, status mapping, and ROLE_USER/ROLE_ADMIN. |
| Gateway | Auth and users namespaces already route to Auth. Register/login are public by method/path. CORS, logging, JWT verification, identity-header stripping and error envelopes already exist; no business change required. |
| Routes | Only public home/login/register/courses were wired. Reuse UserLayout/AdminLayout and guards for small `/account` and `/admin` account views. No course/admin business features added. |
| Persistence | No entities/repositories/controllers or migrations existed. Auth production ddl-auto was validate; test profile was create-drop. Add Flyway and use validate in tests too. |
| MySQL provisioning | Existing service account grants are DML-only. Startup Flyway needs auth_db-scoped DDL privileges; add an explicit SQL grant for local Compose and document existing-volume application. |

No second Axios client, AuthContext, JWT provider or validation implementation was created. No shared JPA entity, refresh token, OAuth2, payment, course, learning or AI functionality was added.
