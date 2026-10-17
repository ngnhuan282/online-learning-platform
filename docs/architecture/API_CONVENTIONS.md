# LearnSphere API conventions

All browser API requests go to `VITE_API_URL`, the API Gateway origin. Paths start with `/api/v1`; do not put `/api/v1` in `VITE_API_URL`. Feature APIs reuse `frontend/web/src/shared/apis/axiosClient.js`. Direct microservice URLs and secrets are forbidden in frontend source or environment variables.

## Routing

Google OIDC login and linking share the Auth namespace and callback. LOGIN codes issue the usual
AuthResponse; LINK completion requires the current JWT and initiating refresh session and returns status.
`POST /api/v1/auth/google/link/start`, `POST /api/v1/auth/google/link/complete` and
`GET /api/v1/users/me/linked-accounts` are protected at Gateway and Auth.
See [Google Login and linking contract](../auth/GOOGLE_LOGIN_REPORT.md) for bodies, errors, cookies and configuration.

| Path | Owner | Local port |
| --- | --- | --- |
| `/api/v1/auth/**` | Auth Service | 8081 |
| `/api/v1/users/**` | Auth Service | 8081 |
| `/api/v1/courses/**` | Course Service | 8082 |
| `/api/v1/learning/**` | Learning Service | 8083 |
| `/api/v1/payments/**` | Payment Service | 8084 |
| `/api/v1/ai/**` | AI Service | 8085 |

Gateway listens on 8080. Paths and query strings are forwarded unchanged. Categories/reviews belong under courses; enrollments/progress/quizzes under learning; orders under payments. Route configuration does not mean those business endpoints are implemented.

## Success

```json
{
  "success": true,
  "message": "Success",
  "data": {},
  "timestamp": "2026-09-15T12:00:00Z"
}
```

Use `ApiResponse.success(responseDto)`. Never return entities, password hashes or credentials. Use HTTP 200 for reads/updates and 201 for resource creation. An empty operation can return `data: null`; use 200 when an envelope is expected. A deliberate 204 response has no body.

Axios resolves the response **envelope**, so callers read `response.data` for the business payload. It does not return an Axios response object. Cancellation uses Axios's `signal` option; the normalized error retains `ERR_CANCELED`.

## Errors

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "errors": { "email": ["must be a well-formed email address"] },
  "timestamp": "2026-09-15T12:00:00Z",
  "path": "/api/v1/auth/register"
}
```

`errors` is `null` for non-validation errors. Validation errors are a map of field names to arrays of messages; object-level errors use `_global`. Never include rejected values. `path` excludes the query string. UTC timestamps use ISO 8601. Messages are safe human-readable descriptions; clients branch on `code`, not message text.

| HTTP | Code |
| --- | --- |
| 400 | `VALIDATION_ERROR`, `MALFORMED_REQUEST`, `BAD_REQUEST` |
| 401 | `UNAUTHORIZED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 405 | `METHOD_NOT_ALLOWED` |
| 409 | `CONFLICT` |
| 415 | `UNSUPPORTED_MEDIA_TYPE` |
| 500 | `INTERNAL_ERROR` (service), `GATEWAY_ERROR` (gateway) |
| 502/503 | `SERVICE_UNAVAILABLE` |
| 504 | `GATEWAY_TIMEOUT` |

Each service owns its `ErrorCode`, `AppException`, `GlobalExceptionHandler`, `ApiError` and response records. Spring Security filter errors use the same envelope because controller advice does not catch filter exceptions. Exceptions are logged on the server; responses never include exception details or stack traces. Gateway passes compliant downstream responses through and formats errors that originate in Gateway itself. Actuator health/info use Spring's management contract instead of the business API envelope.

## Pagination

Lists use zero-based `page`, positive `size`, and `sort=createdAt,desc`. Future controllers must bound `size` (recommended maximum 100) and allowlist sorting fields.

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "content": [], "page": 0, "size": 20,
    "totalElements": 0, "totalPages": 0, "last": true
  },
  "timestamp": "2026-09-15T12:00:00Z"
}
```

Convert entity pages to DTO pages before calling `PageResponse.from(page)`.

## Authentication and authorization

Auth/User/RBAC OpenAPI is available through Gateway at `/v3/api-docs` and `/swagger-ui.html`. It describes request validation, the shared success/error envelopes, Bearer JWT and the HttpOnly refresh cookie. Password fields are write-only in the schema; no password, password hash, refresh cookie value or token example belongs in documentation or logs.

`POST /api/v1/admin/users` and `POST /api/v1/admin/roles` return 201 with the existing success envelope; updates and deletes return 200. Frontend callers consume the envelope and do not assume that every successful mutation is 200.

For Auth administration, `/users/me` supplies the current `status`, `roles` and `permissions`. Frontend menus and guards use `permissions` and wait for session restoration; the backend remains authoritative and checks current database roles and account status on Auth/User/RBAC operations. A custom role may grant `ADMIN_ACCESS` and individual `USER_*`, `ROLE_*` or audit permissions. A route with only an access token still needs its own resource or ownership check. Security filters and Gateway return the same `ApiError` shape as controller validation failures: 400 invalid request, 401 missing/invalid authentication, 403 missing permission or inactive account, 404 missing resource and 409 conflicting state. Allowed CORS preflights run before authentication.

The built-in `USER` role is reserved for learners and never contributes admin permissions, even if an older database still has `role_permissions` rows for USER. V6 removes those rows and role updates reject changes to both built-in roles. A user can enter `/admin` only through `ADMIN` or an explicitly assigned custom role with `ADMIN_ACCESS`.

This contract covers Auth/User/RBAC. Course, Learning and Payment pages that still use demo fallback data are pending their owners' API integration; demo records are not evidence of backend integration.

Send `Authorization: Bearer <accessToken>`. JWT is signed with HS256 and validates signature, issuer, expiration, issued-at, nonempty subject, `tokenType: access` and `role: USER|ADMIN`. Only Auth exposes token issuance; all services and Gateway verify tokens. Default access-token lifetime is 900 seconds; allowed configuration is 1–86400 seconds. `JWT_SECRET` must be at least 32 UTF-8 bytes of random data and identical across backend processes. HS256 verification keys can also sign tokens; keep them within trusted backend deployments.

Built-in JWT roles include `USER` and `ADMIN`; custom roles are also supported. Auth administration uses `@adminAccess.allowed(authentication, 'PERMISSION_CODE')` against the current database state. Other services must enforce their own ownership and authorization rules. Frontend guards only control navigation.

Explicit guest operations include the four POST Auth endpoints, GET course list and a single course, actuator health, and Auth OpenAPI. All other operations require a token. Deeper course content is protected. Future route authors must add appropriate ownership/permission checks, including any new administrative GET endpoint; broad guest patterns must never expose paid lessons or draft content. VNPay callbacks will need a narrowly scoped guest route plus signature validation when payment implementation begins.

Gateway removes incoming `X-User-Id`, `X-User-Role` and `X-User-Roles`; services derive identity from the signed JWT. CORS uses an allowlist from `CORS_ALLOWED_ORIGINS` and runs before authentication. Requests receive a server-generated `X-Request-ID`; logs omit authorization, payloads and query strings.

## Frontend session contract

Protected routes retain the requested pathname, query string and hash through login/register navigation and successful registration. After login, the form returns to that internal destination; without one it uses the role-based default. External URLs and login/register destinations are rejected by the existing redirect check.

Successful login data includes `{ accessToken, tokenType, expiresIn, user }`; `useAuth().login(values)` calls the existing authApi and establishes the session. `establishSession(response.data)` remains available. User contains `{ id, fullName, email, roles }`. AuthProvider restores persisted sessions using `/api/v1/users/me`; guards consume the returned user roles, not decoded JWT roles. Auth storage keeps only the access token, with an in-memory fallback when storage is blocked. The quiz UI separately keeps the current attempt's answer draft in session storage, keyed by user, quiz and attempt; it is not an authentication credential. Passwords and backend secrets are never persisted. Decoding claims in the browser does not verify the signature.

## User quiz attempts and answer review

All paths below require an authenticated user. Published quiz questions require enrollment in the course; the question payload omits correct-answer flags. Draft quizzes are not available to learners.

| Method / path | Request | Data / status |
| --- | --- | --- |
| GET `/api/v1/learning/quizzes/{quizId}` | None | Published quiz without answer key / 200 |
| POST `/api/v1/learning/quizzes/{quizId}/attempts` | None | In-progress attempt summary / 200; resumes an unexpired attempt |
| POST `/api/v1/learning/quizzes/attempts/{attemptId}/submit` | `{ "answers": [{ "questionId": 1, "optionIds": [2] }] }` | Graded attempt summary / 200 |
| GET `/api/v1/learning/quizzes/{quizId}/result` | None | Latest graded attempt summary / 200 |
| GET `/api/v1/learning/quizzes/attempts/{attemptId}/review` | None | Graded attempt with answer review / 200 |

Each question has a positive point value. A single-choice question accepts at most one option; a multiple-choice question requires the exact set of correct options. A correct question earns all its points, otherwise zero. Omitted questions earn zero. `score` is the rounded percentage of points earned over available points; `passed` is `score >= passingScore`. Duplicate question/option IDs, unknown IDs and options from another question are rejected with 400. An attempt can be submitted only once; an expired or already graded attempt returns 409. A later start creates a new attempt after grading.

Review is specific to one attempt. It returns `attemptId`, `quizId`, `courseId`, `quizTitle`, `score`, `passed`, `passingScore`, `startedAt`, `submittedAt`, and ordered `questions`. Each question includes `id`, `questionText`, `questionType`, `position`, `points`, `pointsAwarded`, `answered`, `correct`, and ordered `options`. Each option includes `id`, `optionText`, `position`, `selected`, and `correct`. Only the attempt owner can read it: another user's attempt returns 404, and an ungraded attempt returns 409. The user result page uses `/quizzes/attempts/{attemptId}/result`; the older `/quizzes/{quizId}/result` route resolves the latest graded attempt for compatibility.

Protected requests returning 401 share one cookie refresh operation, save the new access token through the existing storage abstraction, and retry once. Login/register/refresh/logout never trigger automatic refresh. A failed refresh or a second 401 clears the matching local session. Late responses cannot replace or clear a newer login. Startup with a missing/expired access token tries refresh, then loads the authoritative profile from `/users/me`.

Logout calls the backend to revoke the refresh token and expire its cookie, then clears local access/user state. It waits for any in-flight login/rotation before sending revocation. Network failure still clears the local session and displays that server logout could not be confirmed. Already-issued access JWTs remain valid until expiry.

Login/register call Auth through Gateway. `CustomUserDetailsService` reads auth-local users and roles. Registration always creates an ACTIVE USER and ignores caller role/status fields; no account/password is seeded. Refresh tokens are persisted as hashes only; OAuth2 is not implemented.

## Auth endpoints

| Method / path | Request | Data / status |
| --- | --- | --- |
| POST `/api/v1/auth/register` | `{ fullName, email, password }` | UserResponse / 201 |
| POST `/api/v1/auth/login` | `{ email, password }` | `{ accessToken, tokenType: "Bearer", expiresIn, user }` / 200 |
| GET `/api/v1/users/me` | Bearer access token | UserResponse from auth_db / 200 |
| POST `/api/v1/auth/refresh` | HttpOnly refresh cookie only | Existing AuthResponse / 200, rotated cookie |
| POST `/api/v1/auth/logout` | Refresh cookie if present | ApiResponse with data=null / 200, cleared cookie |

UserResponse: `{ id, fullName, email, roles: ["USER"] }`. `expiresIn` is seconds. Emails are trimmed/lowercased before validation/persistence/authentication. Full name is trimmed and limited to 100 characters; email to 254; registration password requires 8 characters and at most 72 UTF-8 bytes for BCrypt. Confirm password is never persisted or transmitted by the client.

Auth domain errors: EMAIL_ALREADY_EXISTS (409), INVALID_CREDENTIALS (401, same for unknown email/wrong password), ACCOUNT_DISABLED/ACCOUNT_LOCKED (403), USER_NOT_FOUND (404), ROLE_NOT_FOUND (500). UNAUTHENTICATED/ACCESS_DENIED are also defined; existing filters retain UNAUTHORIZED/FORBIDDEN for compatibility. Inactive account status is disclosed only after password verification. `/me` also rejects inactive accounts.

Issued JWTs use the immutable user ID as subject and include `roles` plus legacy `role` (ADMIN when present, otherwise USER). Auth maps all roles to authorities; other foundation services continue validating the legacy role. Restore errors 401/403/404 clear the local session; network/5xx errors retain the token but leave the user unauthenticated with a retry action on protected routes.

## Registration validation

Auth Service also returns HTTP 400 with `code: VALIDATION_ERROR` for path/query parameters that cannot be converted to their declared type (for example an invalid user ID, page, size or status). The `errors` map identifies the parameter; rejected values and internal conversion details are not returned.

Registration requires a nonblank full name (maximum 100 characters), a valid email (maximum 254 characters), and a password of at least 8 characters containing an ASCII uppercase letter, lowercase letter, and digit. Passwords must not exceed 72 UTF-8 bytes, including multibyte characters. The backend enforces these requirements even when the caller bypasses the form. Password validation failures return HTTP 400 with `code: VALIDATION_ERROR` and messages under `errors.password`; rejected password values are never returned.

The login form also checks the 72-byte limit. Login continues to verify existing BCrypt hashes without reapplying registration strength requirements, so existing accounts with older passwords can still sign in. Confirmation and terms acceptance are checked by the registration form and are not part of the API request DTO.

## Refresh-token contract

Refresh tokens contain 32 SecureRandom bytes encoded as unpadded Base64url. Only the SHA-256 hex hash is stored in `auth_db.refresh_tokens`. Every refresh transaction locks the old token row, verifies expiration/revocation and account status, revokes the old token and inserts a new hash. Multiple sessions are independent. Concurrent use of the same token has one winner; the old token cannot refresh again.

Login and refresh set `refresh_token` with HttpOnly, SameSite=Lax, Path=/api/v1/auth and configurable Secure. It is a session cookie (no persistent Max-Age/Expires); server expiration defaults to seven days via REFRESH_TOKEN_EXPIRATION_SECONDS. Production HTTPS should set REFRESH_COOKIE_SECURE=true. No refresh value appears in JSON or JavaScript storage. Logout expires the matching cookie with Max-Age=0 and is idempotent.

The four POST Auth endpoints are public and ignore stale Bearer tokens. Other routes retain existing JWT rules. Gateway CORS allows only configured origins, enables credentials, rejects wildcard origins, and forwards cookies normally. Axios uses withCredentials=true. SameSite=Lax requires frontend/Gateway deployment on the same site; local localhost ports satisfy this.

Refresh authentication failures use 401: REFRESH_TOKEN_MISSING, REFRESH_TOKEN_INVALID, REFRESH_TOKEN_EXPIRED, REFRESH_TOKEN_REVOKED. Disabled/locked accounts retain ACCOUNT_DISABLED/ACCOUNT_LOCKED (403). Failed refresh clears the local token; a temporary `/me` failure without refresh retains it. Explicit retry can retry startup restoration. Refresh never loops automatically; password reset, verification and Remember Me are not implemented. Google OIDC login and linking use this same session machinery as documented above.
