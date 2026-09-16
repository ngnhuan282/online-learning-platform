# LearnSphere API conventions

All browser API requests go to `VITE_API_URL`, the API Gateway origin. Paths start with `/api/v1`; do not put `/api/v1` in `VITE_API_URL`. Feature APIs reuse `frontend/web/src/shared/apis/axiosClient.js`. Direct microservice URLs and secrets are forbidden in frontend source or environment variables.

## Routing

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

Send `Authorization: Bearer <accessToken>`. JWT is signed with HS256 and validates signature, issuer, expiration, issued-at, nonempty subject, `tokenType: access` and `role: USER|ADMIN`. Only Auth exposes token issuance; all services and Gateway verify tokens. Default access-token lifetime is 900 seconds; allowed configuration is 1–86400 seconds. `JWT_SECRET` must be at least 32 UTF-8 bytes of random data and identical across backend processes. HS256 verification keys can also sign tokens; keep them within trusted backend deployments.

JWT role values are `USER` and `ADMIN`. Spring authorities are `ROLE_USER` and `ROLE_ADMIN`. Future privileged service methods must use `@PreAuthorize("hasRole('ADMIN')")`; an authenticated route alone does not enforce business ownership or administrator permissions. Frontend guards only control navigation.

Explicit guest operations: POST login/register, GET course list and a single course, and actuator health. All other operations require a token. Deeper course content is protected. Future route authors must add appropriate ownership/role checks, including any new administrative GET endpoint; broad guest patterns must never expose paid lessons or draft content. VNPay callbacks will need a narrowly scoped guest route plus signature validation when payment implementation begins.

Gateway removes incoming `X-User-Id`, `X-User-Role` and `X-User-Roles`; services derive identity from the signed JWT. CORS uses an allowlist from `CORS_ALLOWED_ORIGINS` and runs before authentication. Requests receive a server-generated `X-Request-ID`; logs omit authorization, payloads and query strings.

## Frontend session contract

Successful login data includes `{ accessToken, tokenType, expiresIn, user }`; `useAuth().login(values)` calls the existing authApi and establishes the session. `establishSession(response.data)` remains available. User contains `{ id, fullName, email, roles }`. AuthProvider restores persisted sessions using `/api/v1/users/me`; guards consume the returned user roles, not decoded JWT roles. Session storage keeps only the access token, with an in-memory fallback when storage is blocked. Passwords and backend secrets are never persisted. Decoding claims in the browser does not verify the signature.

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

## Refresh-token contract

Refresh tokens contain 32 SecureRandom bytes encoded as unpadded Base64url. Only the SHA-256 hex hash is stored in `auth_db.refresh_tokens`. Every refresh transaction locks the old token row, verifies expiration/revocation and account status, revokes the old token and inserts a new hash. Multiple sessions are independent. Concurrent use of the same token has one winner; the old token cannot refresh again.

Login and refresh set `refresh_token` with HttpOnly, SameSite=Lax, Path=/api/v1/auth and configurable Secure. It is a session cookie (no persistent Max-Age/Expires); server expiration defaults to seven days via REFRESH_TOKEN_EXPIRATION_SECONDS. Production HTTPS should set REFRESH_COOKIE_SECURE=true. No refresh value appears in JSON or JavaScript storage. Logout expires the matching cookie with Max-Age=0 and is idempotent.

The four POST Auth endpoints are public and ignore stale Bearer tokens. Other routes retain existing JWT rules. Gateway CORS allows only configured origins, enables credentials, rejects wildcard origins, and forwards cookies normally. Axios uses withCredentials=true. SameSite=Lax requires frontend/Gateway deployment on the same site; local localhost ports satisfy this.

Refresh authentication failures use 401: REFRESH_TOKEN_MISSING, REFRESH_TOKEN_INVALID, REFRESH_TOKEN_EXPIRED, REFRESH_TOKEN_REVOKED. Disabled/locked accounts retain ACCOUNT_DISABLED/ACCOUNT_LOCKED (403). Failed refresh clears the local token; a temporary `/me` failure without refresh retains it. Explicit retry can retry startup restoration. No automatic refresh loop, password reset, verification, OAuth2 or Remember Me behavior is added.
