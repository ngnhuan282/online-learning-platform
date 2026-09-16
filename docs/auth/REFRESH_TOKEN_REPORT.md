# Refresh Token completion report

Completed 2026-09-16. Scope: Refresh Token support for existing Auth v1 only. Existing registration/login response bodies, UI and foundation remain compatible.

## CREATED

- `backend/auth-service/src/main/resources/db/migration/V3__create_refresh_tokens.sql`
- Under `backend/auth-service/src/main/java/com/elearning/auth/`: `entity/RefreshToken.java`, `repository/RefreshTokenRepository.java`, `service/RefreshTokenService.java`, `service/impl/RefreshTokenServiceImpl.java`, `security/RefreshTokenCookie.java`
- `backend/auth-service/src/test/java/com/elearning/auth/RefreshTokenTests.java`
- `frontend/web/tests/refresh.test.js`
- `frontend/web/scripts/refresh-scenarios.mjs`
- `docs/REFRESH_TOKEN_REPORT.md`

## MODIFIED

- Auth `controller/AuthController.java`: issue cookie on login; refresh and logout endpoints.
- Auth `common/exception/ErrorCode.java`: four refresh authentication errors.
- Auth `security/JwtTokenProvider.java`: unique jti so renewed access tokens differ even within the same second.
- Auth `security/JwtAuthenticationFilter.java`, `security/SecurityConfig.java`: four public POST Auth routes remain usable with stale Bearer headers.
- Auth `src/main/resources/application.yml`: refresh lifetime and Secure-cookie settings.
- Auth `AuthFlowTests.java`: expected Flyway SQL migration count changes from two to three; existing assertions retained.
- Gateway `filter/AuthenticationFilter.java`, `config/CorsConfig.java`, `ApiGatewayApplicationTests.java`: public refresh/logout, credential CORS, rejection of wildcard origins and regression coverage.
- Frontend `shared/apis/axiosClient.js`, `shared/apis/endpoints.js`: credentials, shared refresh promise, one retry, endpoint exclusions and session-race protection.
- Frontend `shared/utils/tokenUtils.js`: session version and explicit-clear tracking; existing access storage remains the sole storage abstraction.
- Frontend `features/auth/api/authApi.js`, `features/auth/context/AuthContext.jsx`: cookie refresh restoration, authoritative `/me`, backend logout and local cleanup.
- Frontend `shared/components/SiteHeader.jsx`, `features/auth/components/AuthForm.jsx`: await logout before redirect and show server-logout failure notice when necessary.
- Frontend `tests/auth.test.js`: retain v1 coverage, adapt expected refresh/logout requests, add restoration and race tests.
- Frontend `scripts/auth-e2e.mjs`: optional `--refresh` scenario and HTTP method evidence; default production Auth v1 regression retained.
- `compose.yaml`, `.env.example`, `README.md`, `docs/API_CONVENTIONS.md`: configuration and current behavior documentation.

## REUSED

Audited existing AuthService/AuthServiceImpl, AuthController, User entity/repository, ErrorCode, JWT provider/filter, SecurityConfig, AuthContext, authApi, Axios, storage/token helpers and Gateway CORS/security before implementation.

Reused Auth v1 login/password checks, account-status checks and UserResponse, existing JWT signing/validation, ApiResponse/ApiError/GlobalExceptionHandler, BCrypt, database connection and Flyway setup. Reused the one Axios client, one AuthContext, access-token storage, `/me`, form validation, existing UI and route guards. Gateway still contains no refresh business logic. No dependency was added.

## DATABASE MIGRATION

V3 creates `refresh_tokens`: id, user_id FK, token_hash, expires_at, revoked_at and created_at. A unique token_hash constraint provides its index; separate indexes cover user_id and expires_at. V1/V2 are unchanged; Hibernate remains `ddl-auto: validate`.

Actual Docker/MySQL startup applied V3. Real browser E2E queried MySQL and verified that issued cookie tokens matched only SHA-256 hashes, rotated rows were revoked, and the logout row was revoked. No raw-token column exists.

## REFRESH TOKEN DESIGN

- 32 SecureRandom bytes (256 bits), unpadded URL-safe Base64; opaque, not JWT.
- Only SHA-256 hexadecimal hash is persisted or used for lookup.
- Default lifetime seven days, configurable through REFRESH_TOKEN_EXPIRATION_SECONDS.
- Rotation is transactional: pessimistically lock old row, check revocation/expiration and active user, revoke old row, insert new hash, issue new access JWT using the existing provider.
- Concurrent rotation of the same token has one successful result; the previous token returns REFRESH_TOKEN_REVOKED afterward.
- Multiple independent sessions per user are allowed; logout revokes only the presented token.
- Frontend shares one in-flight refresh promise, retries the original protected request once, excludes all four Auth endpoints and prevents late responses from reviving an ended session or overwriting a newer login.
- Startup with missing/expired access uses refresh then `/me`. Explicit session clearing prevents an additional automatic restoration attempt after failed refresh.

## COOKIE CONFIGURATION

| Attribute | Value |
| --- | --- |
| Name | refresh_token |
| HttpOnly | true |
| SameSite | Lax |
| Path | /api/v1/auth |
| Secure | REFRESH_COOKIE_SECURE; false locally, configurable true for HTTPS |
| Persistence | Session cookie, no Max-Age/Expires on issuance |
| Logout | Same attributes, empty value and Max-Age=0 |

Raw refresh tokens are sent only in Set-Cookie and received only through Cookie. They are absent from JSON, frontend JavaScript and application storage. Login/refresh responses have Cache-Control: no-store. The existing Remember Me checkbox does not change persistence.

## API ENDPOINTS

| Endpoint | Behavior |
| --- | --- |
| POST /api/v1/auth/login | Existing AuthResponse plus refresh session cookie |
| POST /api/v1/auth/refresh | Cookie authentication, mandatory rotation, existing AuthResponse plus rotated cookie |
| POST /api/v1/auth/logout | Idempotent revocation, clear cookie, successful ApiResponse with data=null |

Refresh errors are 401: REFRESH_TOKEN_MISSING, REFRESH_TOKEN_INVALID, REFRESH_TOKEN_EXPIRED, REFRESH_TOKEN_REVOKED. Existing disabled/locked account errors remain 403. Registration and `/users/me` keep their existing contracts.

## TEST RESULTS

| Required command | Result |
| --- | --- |
| npm run build | PASS |
| npm run lint | PASS |
| npm test | 25 tests PASS |
| mvn -f backend/auth-service/pom.xml verify | 28 tests PASS |
| mvn -f backend/api-gateway/pom.xml verify | 7 tests PASS |
| mvn -f backend/pom.xml verify | All six modules PASS, 63 tests |

Backend tests cover hash-only storage, cookie attributes including Secure configuration, access renewal, rotation/replay, missing/malformed/unknown/body-only/expired/revoked tokens, inactive accounts, idempotent logout, session independence, concurrent rotation and stale access Bearer headers. Existing Auth v1 and foundation tests remain passing.

Frontend tests cover credentials, 401 refresh/retry with preserved request body, retry limit, non-recursive Auth endpoints, failure cleanup, concurrent/delayed 401s, late responses, missing/expired startup restoration, StrictMode, authoritative user roles, backend logout, network failure cleanup and logout during refresh/login. All pre-existing coverage is retained; old expectations were updated only where refresh/logout intentionally change behavior.

Logs: `.tmp/refresh-frontend-tests.log`, `.tmp/refresh-auth-verify.log`, `.tmp/refresh-gateway-verify.log`, `.tmp/refresh-backend-final-verify.log`.

## DOCKER RESULTS

Executed `docker compose --profile backend up --build -d` and `docker compose --profile backend ps`. All seven containers are running; MySQL is healthy. Auth starts with Flyway and Hibernate validation.

For expiry testing only, Auth used JWT_ACCESS_TOKEN_SECONDS=5 through an ignored Compose override. After the final refresh E2E run, recreated Auth using normal Compose and verified JWT_ACCESS_TOKEN_SECONDS=900. No real `.env` file was changed; the database volume was retained.

## E2E RESULTS

Executed real Chrome → existing React form → Gateway → Auth → MySQL, without mocking auth APIs. Refresh scenario uses the actual Vite-loaded application and Axios module so it can trigger a protected request after actual token expiry. The production bundle separately passed the original Auth v1 browser regression.

1. Registered and logged in from React; access token appeared in existing sessionStorage.
2. Chrome cookie inspection confirmed HttpOnly, SameSite=Lax, correct path and session-only cookie; page JavaScript could not read it.
3. Direct MySQL queries verified SHA-256 hash storage and absence of raw-token columns.
4. Waited for the actual five-second JWT lifetime to expire.
5. Called `/users/me` through the application's Axios instance; observed 401 → one successful `/auth/refresh` → successful protected retry.
6. Confirmed rotated cookie differs, old database row is revoked and replay of the old cookie returns REFRESH_TOKEN_REVOKED.
7. Removed access token from sessionStorage and reloaded; cookie refresh plus `/me` restored the real user.
8. Logged out through the existing UI; database row revoked, cookie removed, access/user cleared.
9. Confirmed refresh fails with 401 after logout, both without a cookie and when replaying the revoked cookie.
10. Re-ran production Auth v1 scenarios: registration, login, reload, logout, credential errors, duplicate email, USER/ADMIN guard and mobile layout pass.

Final refresh evidence: `.tmp/refresh-e2e/results.json` (completed 2026-09-16T13:33:38Z), `.tmp/refresh-e2e-run.log` and screenshot `.tmp/refresh-e2e/account-desktop.png`. Database proof is recorded as boolean assertions; raw cookies/passwords are never written into evidence reports. Production regression log: `.tmp/refresh-auth-v1-regression.log`.

To repeat refresh E2E, temporarily run Auth with JWT_ACCESS_TOKEN_SECONDS=5, keep frontend port 5173 free, then run `node scripts/auth-e2e.mjs --refresh` from `frontend/web`. Set CHROME_PATH if Chrome is installed elsewhere. Restore the normal Compose configuration afterward. For production Auth v1 regression, run `npm run build` then `node scripts/auth-e2e.mjs`.

## SECURITY NOTES

Gateway credential CORS uses explicit configured origins, rejects wildcard origins and untrusted origins, and retains existing logging/header stripping. SameSite=Lax and POST endpoints restrict cross-site cookie use; frontend/Gateway must use a compatible same-site deployment. Use HTTPS and REFRESH_COOKIE_SECURE=true in production.

No passwords, raw refresh tokens or token hashes are included in API error messages. Refresh values are never accepted from request JSON or Authorization. Internal rotation results redact their string representation. Database row locking prevents concurrent replay even across Auth instances.

## WARNINGS

- Logout revokes refresh authentication; already-issued access JWTs remain valid until expiration.
- If the logout network request fails, local state is cleared and the UI reports that server logout could not be confirmed. An HttpOnly cookie cannot be deleted by application JavaScript.
- Refresh coordination is per running frontend instance; database locking enforces token rotation across instances. No token-family revocation or background cleanup job was added to this scoped task.
- Local test accounts/token history remain in MySQL. No data volumes were deleted. Git metadata is absent, so no commit/PR was created.
- Password reset, forgot password, email verification, OAuth2, Course features and Remember Me are outside this implementation.

## NEXT RECOMMENDED TASK

Course public catalog, or a separately specified Auth password-reset task.
