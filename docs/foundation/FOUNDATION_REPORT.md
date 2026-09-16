# Common foundation completion report

Completed 2026-09-15. Scope follows the attached foundation task and the v1.2 system specification. Existing pages, CSS, design assets, auth form behavior and demo data are preserved. No business feature, page, entity, repository, OAuth2 flow or refresh-token implementation was added.

## Verification

| Check | Result |
| --- | --- |
| Frontend production build (`npm run build`) | PASS |
| Frontend ESLint (`npm run lint`) | PASS |
| Frontend foundation tests (`npm test`) | 4 tests PASS |
| Existing Chrome headless auth/UI regression | PASS at 375, 390, 768, 1024, 1280, 1600 px |
| Clean Maven build and verify, all six applications | 42 tests PASS |
| Gateway and service startup | Real HTTP servers started on random ports in tests |
| Compose configuration | 7 services validated; separate credentials/database for each service |
| MySQL initialization script | Bash syntax check PASS; actual SQL execution still requires MySQL |
| Java packages and duplicate classes | 62 production Java files; no duplicate fully qualified classes or package/path mismatch |
| Frontend Axios | Exactly one `axios.create`; common client, auth adapter, guards and components compile |
| Secrets and API prefixes | No old hard-coded database password or old unversioned API paths in source |
| MySQL/Docker runtime | Not verified: Docker Engine is unavailable in this environment |

| Backend application | Tests | Result |
| --- | --- | --- |
| auth-service | 8 | PASS |
| course-service | 7 | PASS |
| learning-service | 7 | PASS |
| payment-service | 7 | PASS |
| ai-service | 7 | PASS |
| api-gateway | 6 | PASS |

Backend coverage: safe success/error envelopes, validation errors, malformed JSON, 401/403/404/409/500, pagination, valid/expired/malformed/wrong-signature/wrong-issuer/wrong-type JWTs, missing claims, USER/ADMIN authority, fail-closed Auth user lookup and independent health checks. Gateway coverage includes all six namespaces, public-route restrictions, CORS preflight and rejection format, identity-header stripping, request IDs, 503/504 and safe fallback errors. Test-only controllers never ship in production jars.

Frontend coverage: token decoding/expiry, Unicode subjects, blocked browser storage, Axios bearer attachment, envelope unwrapping, auth requests without stale credentials, normalized errors, URL bypass rejection and late 401 protection. Browser regression verifies the existing forms, password meter/toggles, consent, dialogs, honest unavailable notices, navigation, home course cards, no stored credentials, responsive layout and no runtime exceptions. The mobile registration screenshot was also visually inspected.

## CREATED

97 files:

- `.dockerignore`
- `.editorconfig`
- `.env.example`
- `.gitignore`
- `README.md`
- `backend/ai-service/src/main/java/com/elearning/ai/common/exception/AppException.java`
- `backend/ai-service/src/main/java/com/elearning/ai/common/exception/ErrorCode.java`
- `backend/ai-service/src/main/java/com/elearning/ai/common/exception/GlobalExceptionHandler.java`
- `backend/ai-service/src/main/java/com/elearning/ai/common/response/ApiError.java`
- `backend/ai-service/src/main/java/com/elearning/ai/common/response/ApiResponse.java`
- `backend/ai-service/src/main/java/com/elearning/ai/common/response/PageResponse.java`
- `backend/ai-service/src/main/java/com/elearning/ai/security/JwtAuthenticationFilter.java`
- `backend/ai-service/src/main/java/com/elearning/ai/security/JwtTokenProvider.java`
- `backend/ai-service/src/main/java/com/elearning/ai/security/SecurityConfig.java`
- `backend/ai-service/src/main/java/com/elearning/ai/security/SecurityErrorHandler.java`
- `backend/ai-service/src/test/resources/application-test.yml`
- `backend/api-gateway/src/main/java/com/elearning/gateway/config/CorsConfig.java`
- `backend/api-gateway/src/main/java/com/elearning/gateway/exception/GatewayExceptionHandler.java`
- `backend/api-gateway/src/main/java/com/elearning/gateway/filter/AuthenticationFilter.java`
- `backend/api-gateway/src/main/java/com/elearning/gateway/filter/LoggingFilter.java`
- `backend/api-gateway/src/main/java/com/elearning/gateway/security/JwtTokenProvider.java`
- `backend/api-gateway/src/test/java/com/elearning/gateway/GatewayExceptionHandlerTests.java`
- `backend/auth-service/src/main/java/com/elearning/auth/common/exception/AppException.java`
- `backend/auth-service/src/main/java/com/elearning/auth/common/exception/ErrorCode.java`
- `backend/auth-service/src/main/java/com/elearning/auth/common/exception/GlobalExceptionHandler.java`
- `backend/auth-service/src/main/java/com/elearning/auth/common/response/ApiError.java`
- `backend/auth-service/src/main/java/com/elearning/auth/common/response/ApiResponse.java`
- `backend/auth-service/src/main/java/com/elearning/auth/common/response/PageResponse.java`
- `backend/auth-service/src/main/java/com/elearning/auth/security/CustomUserDetailsService.java`
- `backend/auth-service/src/main/java/com/elearning/auth/security/JwtAuthenticationFilter.java`
- `backend/auth-service/src/main/java/com/elearning/auth/security/JwtTokenProvider.java`
- `backend/auth-service/src/main/java/com/elearning/auth/security/SecurityConfig.java`
- `backend/auth-service/src/main/java/com/elearning/auth/security/SecurityErrorHandler.java`
- `backend/auth-service/src/test/resources/application-test.yml`
- `backend/course-service/src/main/java/com/elearning/course/common/exception/AppException.java`
- `backend/course-service/src/main/java/com/elearning/course/common/exception/ErrorCode.java`
- `backend/course-service/src/main/java/com/elearning/course/common/exception/GlobalExceptionHandler.java`
- `backend/course-service/src/main/java/com/elearning/course/common/response/ApiError.java`
- `backend/course-service/src/main/java/com/elearning/course/common/response/ApiResponse.java`
- `backend/course-service/src/main/java/com/elearning/course/common/response/PageResponse.java`
- `backend/course-service/src/main/java/com/elearning/course/security/JwtAuthenticationFilter.java`
- `backend/course-service/src/main/java/com/elearning/course/security/JwtTokenProvider.java`
- `backend/course-service/src/main/java/com/elearning/course/security/SecurityConfig.java`
- `backend/course-service/src/main/java/com/elearning/course/security/SecurityErrorHandler.java`
- `backend/course-service/src/test/resources/application-test.yml`
- `backend/learning-service/src/main/java/com/elearning/learning/common/exception/AppException.java`
- `backend/learning-service/src/main/java/com/elearning/learning/common/exception/ErrorCode.java`
- `backend/learning-service/src/main/java/com/elearning/learning/common/exception/GlobalExceptionHandler.java`
- `backend/learning-service/src/main/java/com/elearning/learning/common/response/ApiError.java`
- `backend/learning-service/src/main/java/com/elearning/learning/common/response/ApiResponse.java`
- `backend/learning-service/src/main/java/com/elearning/learning/common/response/PageResponse.java`
- `backend/learning-service/src/main/java/com/elearning/learning/security/JwtAuthenticationFilter.java`
- `backend/learning-service/src/main/java/com/elearning/learning/security/JwtTokenProvider.java`
- `backend/learning-service/src/main/java/com/elearning/learning/security/SecurityConfig.java`
- `backend/learning-service/src/main/java/com/elearning/learning/security/SecurityErrorHandler.java`
- `backend/learning-service/src/test/resources/application-test.yml`
- `backend/payment-service/src/main/java/com/elearning/payment/common/exception/AppException.java`
- `backend/payment-service/src/main/java/com/elearning/payment/common/exception/ErrorCode.java`
- `backend/payment-service/src/main/java/com/elearning/payment/common/exception/GlobalExceptionHandler.java`
- `backend/payment-service/src/main/java/com/elearning/payment/common/response/ApiError.java`
- `backend/payment-service/src/main/java/com/elearning/payment/common/response/ApiResponse.java`
- `backend/payment-service/src/main/java/com/elearning/payment/common/response/PageResponse.java`
- `backend/payment-service/src/main/java/com/elearning/payment/security/JwtAuthenticationFilter.java`
- `backend/payment-service/src/main/java/com/elearning/payment/security/JwtTokenProvider.java`
- `backend/payment-service/src/main/java/com/elearning/payment/security/SecurityConfig.java`
- `backend/payment-service/src/main/java/com/elearning/payment/security/SecurityErrorHandler.java`
- `backend/payment-service/src/test/resources/application-test.yml`
- `backend/pom.xml`
- `docs/API_CONVENTIONS.md`
- `docs/FOUNDATION_AUDIT.md`
- `docs/FOUNDATION_REPORT.md`
- `frontend/web/src/app/providers.jsx`
- `frontend/web/src/features/auth/api/authApi.js`
- `frontend/web/src/features/auth/context/AuthContext.jsx`
- `frontend/web/src/features/auth/hooks/useAuth.js`
- `frontend/web/src/layouts/UserLayout.jsx`
- `frontend/web/src/routes/ProtectedRoute.jsx`
- `frontend/web/src/routes/RoleRoute.jsx`
- `frontend/web/src/shared/apis/endpoints.js`
- `frontend/web/src/shared/components/AppLoading.jsx`
- `frontend/web/src/shared/components/ConfirmDialog.jsx`
- `frontend/web/src/shared/components/EmptyState.jsx`
- `frontend/web/src/shared/components/ErrorState.jsx`
- `frontend/web/src/shared/components/PageHeader.jsx`
- `frontend/web/src/shared/components/StatusChip.jsx`
- `frontend/web/src/shared/constants/appConstants.js`
- `frontend/web/src/shared/constants/roles.js`
- `frontend/web/src/shared/constants/storageKeys.js`
- `frontend/web/src/shared/hooks/useDebounce.js`
- `frontend/web/src/shared/utils/errorUtils.js`
- `frontend/web/src/shared/utils/formatCurrency.js`
- `frontend/web/src/shared/utils/formatDate.js`
- `frontend/web/src/shared/utils/tokenUtils.js`
- `frontend/web/src/styles/theme.js`
- `frontend/web/tests/foundation.test.js`
- `infra/docker/service.Dockerfile`
- `infra/mysql/02-users.sh`

## MODIFIED

28 files:

- `backend/ai-service/pom.xml`
- `backend/ai-service/src/main/resources/application.yml`
- `backend/ai-service/src/test/java/com/elearning/ai/AiServiceApplicationTests.java`
- `backend/api-gateway/pom.xml`
- `backend/api-gateway/src/main/resources/application.yml`
- `backend/api-gateway/src/test/java/com/elearning/gateway/ApiGatewayApplicationTests.java`
- `backend/auth-service/pom.xml`
- `backend/auth-service/src/main/resources/application.yml`
- `backend/auth-service/src/test/java/com/elearning/auth/AuthServiceApplicationTests.java`
- `backend/course-service/pom.xml`
- `backend/course-service/src/main/resources/application.yml`
- `backend/course-service/src/test/java/com/elearning/course/CourseServiceApplicationTests.java`
- `backend/learning-service/pom.xml`
- `backend/learning-service/src/main/resources/application.yml`
- `backend/learning-service/src/test/java/com/elearning/learning/LearningServiceApplicationTests.java`
- `backend/payment-service/pom.xml`
- `backend/payment-service/src/main/resources/application.yml`
- `backend/payment-service/src/test/java/com/elearning/payment/PaymentServiceApplicationTests.java`
- `compose.yaml`
- `frontend/web/eslint.config.js`
- `frontend/web/package.json`
- `frontend/web/src/app/App.jsx`
- `frontend/web/src/layouts/AdminLayout.jsx`
- `frontend/web/src/main.jsx`
- `frontend/web/src/shared/apis/axiosClient.js`
- `frontend/web/src/shared/constants/routes.js`
- `frontend/web/src/shared/utils/storage.js`
- `infra/mysql/init.sql`

Key changes: Axios adds configuration checks, bearer handling and normalized errors; App uses providers; empty storage/routes/AdminLayout placeholders are completed. Service POMs gain infrastructure/test dependencies; configuration now uses the correct service names/ports/databases, environment secrets and schema validation. Gateway routes use `/api/v1`. MySQL initialization now uses five restricted accounts. No existing source file was deleted.

## UNCHANGED / REUSED

- `frontend/web/src/app/router.jsx`: same public routes and lazy-loaded pages.
- `frontend/web/src/layouts/MainLayout.jsx`: retained as PublicLayout; User/Admin reuse its shell.
- `frontend/web/src/features/auth/schemas/authValidation.js`: reused instead of adding a duplicate `authSchema.js`.
- Existing auth pages/forms/dialogs, home/course pages, demo data, CSS, navigation/footer, icons and image assets.
- Existing `shared/apis` folder: retained instead of creating a competing `shared/api` folder.
- All six `com.elearning.*` packages and Spring Boot application entry points; existing Maven wrappers.
- Existing specification `.docx`, `docs/DESIGN.md`, frontend `.env.example`, and all actual `.env` files.
- Empty ForbiddenPage/NotFoundPage placeholders stay unused because this task excludes new pages.

## DEPENDENCIES ADDED

- All six backend applications: `io.jsonwebtoken:jjwt-api`, `jjwt-impl`, `jjwt-jackson` 0.13.0. Runtime implementation/JSON integration stay in runtime scope.
- Course/Learning/Payment/AI: `spring-boot-starter-security` (Auth already had it).
- Five business services: `com.h2database:h2` in test scope only.
- Gateway: Spring Cloud BOM 2025.1.2, `spring-cloud-starter-gateway-server-webflux`, `spring-boot-starter-webflux-test` in test scope.
- Frontend: no new dependency. Tests use Node's built-in runner and existing Vite.

Boot 4.1.1 and Java 21 are preserved. Compatibility references: [Spring Cloud matrix](https://cloud.spring.io/), [JJWT](https://github.com/jwtk/jjwt), [Boot Jackson migration](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide).

## WARNINGS

- Docker CLI exists but Docker Engine is stopped/unavailable. Compose syntax and isolation were checked; actual MySQL initialization, grants and full Docker image startup still need a running Engine. Independent service HTTP tests use H2 and are not evidence of MySQL runtime verification.
- Existing MySQL volumes do not rerun initialization. An administrator must provision the new service accounts and retire the old shared account/grants after checking consumers. No data/volume or local secret was modified automatically.
- Populate required variables from `.env.example`. Java does not load root `.env` automatically; supply environment variables in the terminal/IDE. Optional VNPay/S3/AI settings remain unused until those integrations exist.
- Auth user persistence and business endpoints intentionally remain unimplemented. `CustomUserDetailsService.UserLookup` fails closed when no adapter exists. No generated default credentials remain in any service.
- Access tokens use session storage with memory fallback; browser decoding is for UI only. Backend remains authoritative. Refresh/revocation/remember-me are deferred; local logout cannot invalidate an already issued token server-side.
- Existing demo pages remain usable without backend services. Login/register continue to report that the feature is unavailable; no fake account or successful login is introduced.
- No Git metadata is present in the supplied workspace. Created/modified lists come from a source-file hash inventory taken before edits.
- Sandbox restrictions required approved execution for Maven dependency caching, Vite/Node subprocesses and Chrome. One incremental Maven rerun encountered a missing compiled class; a clean build rebuilt all outputs and passed. Intentional exception-path tests log server-side errors while asserting sanitized client responses.

## NEXT RECOMMENDED TASK

Auth Register/Login end-to-end: auth-local schema and user lookup, registration/login services/controllers/DTO validation, BCrypt, account status and role assignment, then connect existing frontend forms to `authApi` and `establishSession`. Decide refresh-token/revocation policy in that task.
