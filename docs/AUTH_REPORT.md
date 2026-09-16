# Auth Register/Login completion report

Completed 2026-09-16. The existing foundation and Login/Register design were retained. Real React → API Gateway → Auth Service → MySQL execution passed in Chrome, followed by direct database verification.

## CREATED

All Java paths below are under `backend/auth-service/src/main/java/com/elearning/auth/`:

- `entity/User.java`, `entity/Role.java`
- `entity/enums/RoleName.java`, `entity/enums/UserStatus.java`
- `repository/UserRepository.java`, `repository/RoleRepository.java`
- `dto/RegisterRequest.java`, `dto/LoginRequest.java`, `dto/AuthResponse.java`, `dto/UserResponse.java`
- `service/AuthService.java`, `service/impl/AuthServiceImpl.java`
- `controller/AuthController.java`, `controller/UserController.java`

Other new files:

- `backend/auth-service/src/main/resources/db/migration/V1__create_auth_schema.sql`
- `backend/auth-service/src/main/resources/db/migration/V2__seed_roles.sql`
- `backend/auth-service/src/test/java/com/elearning/auth/AuthFlowTests.java`
- `frontend/web/src/features/auth/pages/AccountPage.jsx`
- `frontend/web/tests/auth.test.js`
- `frontend/web/scripts/auth-e2e.mjs`
- `infra/mysql/03-auth-migrations.sql`
- `docs/AUTH_AUDIT.md`, `docs/AUTH_REPORT.md`

## MODIFIED

- Auth `pom.xml`: Boot Flyway starter and Flyway MySQL support.
- Auth `common/exception/ErrorCode.java`: required Auth domain errors; generic foundation error codes retained.
- Auth `security/CustomUserDetailsService.java`: repository lookup, normalized email, roles and account statuses.
- Auth `security/JwtTokenProvider.java`: database user ID subject, plural roles, lifetime accessor; legacy role remains compatible.
- Auth `security/JwtAuthenticationFilter.java`: maps all JWT roles to Spring authorities.
- Auth `src/test/resources/application-test.yml`: Flyway migrations plus `ddl-auto: validate`, replacing test create-drop.
- Frontend `features/auth/api/authApi.js`: registration sends only fullName/email/password.
- Frontend `features/auth/context/AuthContext.jsx`: login/register/session establishment, server user, `/me` restore, expiry, local logout, retry and stale-request protection.
- Frontend `features/auth/components/AuthForm.jsx`: real API submission through useAuth, loading state, normalized field errors, registration success notice and navigation.
- Frontend `features/auth/schemas/authValidation.js`: length bounds and BCrypt UTF-8 byte limit in the existing validator.
- Frontend `routes/ProtectedRoute.jsx`, `routes/RoleRoute.jsx`: restore error handling and server-returned user roles.
- Frontend `shared/components/SiteHeader.jsx`: account link and local logout.
- Frontend `app/router.jsx`: `/account` and `/admin` using existing layouts/guards.
- Frontend `package.json`, `package-lock.json`: jsdom as a development-only dependency for component tests.
- `compose.yaml`, `infra/mysql/init.sql`: local Auth migration grants and provisioning documentation.
- `README.md`, `docs/API_CONVENTIONS.md`: implemented behavior, API/session contracts, migration and run instructions.

## REUSED

Existing single Axios client, endpoints, authApi, AuthContext, useAuth, authValidation, sessionStorage/memory token helpers, normalized errors and late-401 protection. Existing Login/Register pages, form markup/styles, fields, notices, password controls and dialogs. Existing MainLayout/UserLayout/AdminLayout, route guards and shared loading/error components.

Existing ApiResponse, ApiError, PageResponse, AppException, GlobalExceptionHandler, SecurityConfig, BCrypt encoder, SecurityErrorHandler, JwtTokenProvider and JWT filter. Gateway routing, JWT validation, public/private rules, CORS, logging, header stripping and safe errors are unchanged. No shared entity, OAuth2, refresh token or unrelated business feature was introduced.

## DATABASE MIGRATIONS

- V1 creates `roles`, `users`, `user_roles`, unique email/role constraints, composite role assignment key and foreign keys.
- V2 seeds only USER and ADMIN. No account or password is seeded.
- Emails are trimmed/lowercased; new accounts are ACTIVE with USER only. Passwords are BCrypt hashes.
- Production Hibernate remains `ddl-auto: validate`; the test profile now also validates Flyway-created tables.
- Actual MySQL 8.4.11 execution: versions 1 and 2 both recorded with `success=1`; Hibernate validation and service startup passed.
- The existing MySQL volume initially lacked DDL permissions. Applied `03-auth-migrations.sql` to grant CREATE/ALTER/INDEX/REFERENCES only on `auth_db` to `auth_app`, then restarted Auth. The file is mounted for fresh Compose initialization. Existing data was retained.

## API ENDPOINTS

| Endpoint | Result |
| --- | --- |
| POST `/api/v1/auth/register` | 201 ApiResponse<UserResponse> |
| POST `/api/v1/auth/login` | 200 ApiResponse<AuthResponse> |
| GET `/api/v1/users/me` | 200 ApiResponse<UserResponse>, requires Bearer token |

Registration accepts fullName/email/password and always assigns USER; caller roles/status are not trusted. UserResponse contains id/fullName/email/roles. AuthResponse contains accessToken/tokenType/expiresIn/user. Wrong email/password both return INVALID_CREDENTIALS. Locked/disabled status is returned only after correct password verification. `/me` loads the current database user using the authenticated subject and checks status.

JWT claims include immutable ID subject, issuer, issuedAt, expiration, tokenType=access and roles; legacy role is kept for other foundation consumers. Signing continues to use JWT_SECRET.

## TEST RESULTS

| Required command | Result |
| --- | --- |
| `npm run build` | PASS |
| `npm run lint` | PASS |
| `npm test` | 14 PASS: 4 existing foundation + 10 Auth |
| `mvn -f backend/auth-service/pom.xml verify` | 19 PASS: 8 existing + 11 Auth |
| `mvn -f backend/api-gateway/pom.xml verify` | 6 PASS |
| `mvn -f backend/pom.xml verify` | All six modules PASS, 53 tests |

Backend coverage includes normalized registration, BCrypt, ignored role/status inputs, duplicate and concurrent registration, invalid input, successful login, unknown email/wrong password, locked/disabled accounts, JWT claims/lifetime, protected `/me`, database-authoritative profile, expired/malformed/missing tokens, UserDetails authorities, multi-role ADMIN authorization and Flyway. All foundation tests still pass.

Frontend coverage includes API request mapping, public request headers, establishment/storage/logout, invalid session responses, server-authoritative restoration, expired cleanup, 401 cleanup, recoverable `/me` failure, logout during an in-flight request, ProtectedRoute and RoleRoute. Existing token/error/Axios tests remain unchanged and pass.

Build/test logs are in `.tmp/auth-verify.log`, `.tmp/gateway-verify.log`, `.tmp/backend-final-verify.log`, `.tmp/auth-frontend-tests.log`. Initial sandbox subprocess restrictions were resolved by approved execution. Initial test-only Flyway row-count and Emotion setup issues were corrected; final runs pass.

## DOCKER RUNTIME

`docker compose --profile backend up --build -d` executed. Final `ps` showed all seven services Up and MySQL healthy. Auth startup log confirmed both migrations applied and HTTP server running on 8081. Gateway is exposed on 8080; internal service ports remain internal. Containers remain running for review.

## MANUAL E2E RESULTS

The requested checklist was executed through real Chrome headless automation, not manual clicking and not mocked API responses. Production React was served at localhost:5173 and called Gateway at localhost:8080.

| Check | Result |
| --- | --- |
| Register via React and navigate to login with success notice | PASS |
| Confirm UI-created user in auth_db | PASS, direct SQL verification |
| BCrypt hash prefix and 60-character hash; no raw password columns | PASS, direct SQL verification |
| Login using the UI-created account | PASS |
| Store only access token through existing abstraction | PASS; one sessionStorage entry, no localStorage data |
| AuthContext displays the returned user | PASS, account page renders server full name/email |
| Reload restores session using real `/me` | PASS, observed Gateway request and returned profile |
| Logout clears token/user and guest guard redirects | PASS |
| Invalid credentials show expected form notice | PASS, real 401 response |
| USER cannot enter ADMIN-only route | PASS |
| Duplicate registration displays email field error | PASS, real 409 response |
| Mobile width and browser runtime exceptions | PASS, no horizontal overflow or runtime exceptions |

Gateway-only API register/login/me smoke tests also passed, including default USER assignment, invalid/missing JWT rejection and duplicate email errors. ADMIN acceptance is covered in backend authorization and frontend component tests; no production administrator account was seeded.

Evidence: `.tmp/auth-e2e/results.json`, `.tmp/auth-e2e/account-desktop.png`, `.tmp/auth-e2e/register-mobile.png`. Successful browser run completed at 2026-09-16T02:17:08Z. UI account: `ui-84dac7d3-3890-40a5-ab08-bae10212bdc5@example.com`; direct SQL verified ACTIVE, USER and BCrypt. Test passwords were generated in memory and not written into the report or result file.

To repeat: start Compose, configure VITE_API_URL=http://localhost:8080, then from `frontend/web` run `npm run build` and `node scripts/auth-e2e.mjs`. Keep port 5173 free; optionally set CHROME_PATH for a different Chrome installation. Each run creates uniquely named test accounts.

## WARNINGS

- Access-token-only milestone: local logout does not revoke an already-issued JWT; no refresh, OAuth2 or password-reset implementation. The existing remember checkbox does not enable persistent storage beyond the browser session.
- Registration does not assign ADMIN. The `/admin` page is a minimal guarded account view, not an administrator business dashboard.
- Existing filters keep UNAUTHORIZED/FORBIDDEN names to preserve foundation contracts. Required UNAUTHENTICATED/ACCESS_DENIED constants are defined; clients should also handle HTTP status.
- Local Compose grants Auth DDL rights only in auth_db. Production may configure a separate migration account through SPRING_FLYWAY_USER/SPRING_FLYWAY_PASSWORD and keep runtime DML-only grants.
- The workspace has no Git metadata; no commit or PR was created. QA accounts remain in the local MySQL database, and screenshots/logs are local ignored artifacts.

## NEXT RECOMMENDED TASK

Course public catalog or Auth refresh/password-reset phase.
