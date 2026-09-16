# PROJECT RULES

> Applies to the entire Online Learning Platform repository.
> Scope: Frontend, Backend microservices, API Gateway, database migrations, tests, Docker, and AI/Agent-generated code.

---

## 1. Purpose

This file defines the engineering rules that every contributor and AI Agent must follow.

Goals:

- keep Frontend and Backend consistent;
- preserve the current architecture;
- avoid duplicate infrastructure;
- keep code readable and maintainable;
- prevent accidental security or API-contract changes;
- make future modules easier to implement and review.

When a task-specific instruction conflicts with this file, the task-specific instruction takes precedence only for that task.

---

# 2. Current Architecture

```text
React + Vite + JavaScript JSX
            |
            v
API Gateway :8080
            |
            +--> Auth Service     :8081 --> auth_db
            +--> Course Service   :8082 --> course_db
            +--> Learning Service :8083 --> learning_db
            +--> Payment Service  :8084 --> payment_db
            +--> AI Service       :8085 --> ai_db
```

Main stack:

```text
Frontend:
- React
- Vite
- JavaScript / JSX
- Material UI
- Axios
- React Router

Backend:
- Java 21
- Spring Boot
- Spring Cloud Gateway
- Spring Security
- Spring Data JPA
- Flyway
- MySQL 8.4
- Maven

Infrastructure:
- Docker Compose
- MySQL
```

The Frontend must call only the API Gateway.

Do not call business services directly from React.

---

# 3. Repository Structure

Keep the project organized around the existing structure.

```text
frontend/
  web/

backend/
  auth-service/
  course-service/
  learning-service/
  payment-service/
  ai-service/
  api-gateway/

infra/
  docker/
  mysql/

docs/

compose.yaml
.env.example
.gitignore
.editorconfig
README.md
RULES.md
```

Do not create a second competing project structure.

---

# 4. General Engineering Rules

Always:

- read the existing implementation before creating new files;
- reuse existing infrastructure where possible;
- preserve working behavior unless the task explicitly requests a change;
- keep each task focused on its requested scope;
- build and test after changes;
- inspect the final diff before reporting completion.

Never:

- create duplicate implementations of existing infrastructure;
- silently change API contracts;
- hard-code secrets;
- commit real `.env` files;
- add unrelated features to the current task;
- rewrite working modules purely because another coding style is preferred;
- weaken or remove tests to make a task pass.

Prefer small, reviewable changes over large rewrites.

---

# 5. Code Readability Rules

Code must be optimized for human readability, not minimum line count.

## 5.1 General

Prefer:

- meaningful names;
- consistent indentation;
- blank lines between logical blocks;
- short methods where natural;
- early returns where they simplify control flow;
- readable local variables for complex expressions.

Target line length:

```text
100–120 characters
```

This is a readability target, not a hard compiler rule.

Do not compress multiple logical operations into a single difficult-to-read line.

Do not expand every trivial statement into many lines either.

---

# 6. Backend Java Style

Use:

```text
4 spaces indentation
```

Leave one blank line between methods.

Example:

```java
@ExceptionHandler(AppException.class)
ResponseEntity<ApiError> handleAppException(
        AppException exception,
        HttpServletRequest request
) {
    return respond(exception.getErrorCode(), null, request);
}

@ExceptionHandler(MethodArgumentNotValidException.class)
ResponseEntity<ApiError> handleValidationException(
        MethodArgumentNotValidException exception,
        HttpServletRequest request
) {
    ...
}
```

Avoid compressed formatting such as:

```java
switch (status) { case 404 -> "NOT_FOUND"; case 405 -> "METHOD_NOT_ALLOWED"; default -> "BAD_REQUEST"; }
```

Prefer:

```java
switch (status) {
    case 404 -> "NOT_FOUND";
    case 405 -> "METHOD_NOT_ALLOWED";
    default -> "BAD_REQUEST";
}
```

Long call chains should be wrapped clearly:

```java
errors
        .computeIfAbsent(error.getField(), key -> new ArrayList<>())
        .add(error.getDefaultMessage());
```

Prefer imports over fully qualified class names inside normal implementation code.

Example:

```java
import java.time.Instant;
```

instead of:

```java
java.time.Instant.now()
```

inside methods.

---

# 7. Java Naming

Use descriptive names.

Prefer:

```text
handleAppException
handleValidationException
handleAuthenticationException
handleAccessDenied
handleUnexpectedException
```

instead of:

```text
app
validation
unauthorized
forbidden
fallback
```

Public API names, DTO fields, database columns, and endpoint paths must not be renamed casually.

Private/local variables may be renamed when readability improves and behavior is unchanged.

---

# 8. Spring Boot Package Rules

Each business service owns its own domain.

Typical structure:

```text
com.elearning.<service>/

  common/
    exception/
    response/

  config/
  controller/
  dto/
    request/
    response/

  entity/
  repository/
  security/
  service/
    impl/
```

Do not create a shared JPA Entity module.

Do not create a shared Repository module.

Do not share database entities between microservices.

Each service must own its own data model.

---

# 9. Microservice Database Ownership

Each service accesses only its own database.

```text
auth-service     --> auth_db
course-service   --> course_db
learning-service --> learning_db
payment-service  --> payment_db
ai-service       --> ai_db
```

A service must never directly query another service's database.

Cross-service information must be exchanged through APIs or an approved integration mechanism.

---

# 10. Database Migration Rules

Use Flyway for schema changes.

Keep:

```yaml
spring:
  jpa:
    hibernate:
      ddl-auto: validate
```

Do not rely on Hibernate to mutate production schemas automatically.

Migration naming:

```text
V1__description.sql
V2__description.sql
V3__description.sql
```

Never edit an already-applied migration simply to change its result.

Create a new migration.

Do not store production passwords or tokens in migration files.

---

# 11. API Conventions

Base prefix:

```text
/api/v1
```

Namespaces:

```text
/api/v1/auth/**
/api/v1/users/**
/api/v1/courses/**
/api/v1/learning/**
/api/v1/payments/**
/api/v1/ai/**
```

Use the existing common response envelope.

Success example:

```json
{
  "success": true,
  "message": "Success",
  "data": {},
  "timestamp": "..."
}
```

Error example:

```json
{
  "success": false,
  "code": "ERROR_CODE",
  "message": "Readable message",
  "errors": null,
  "timestamp": "...",
  "path": "/api/v1/..."
}
```

Do not introduce a second response format unless explicitly approved.

---

# 12. HTTP Status Rules

Use HTTP status codes consistently.

Typical mapping:

```text
200 OK                  successful read/action
201 Created             successful creation
400 Bad Request         malformed/invalid request
401 Unauthorized        unauthenticated / invalid credentials
403 Forbidden           authenticated but not allowed
404 Not Found           resource not found
409 Conflict            duplicate/conflicting state
500 Internal Server Error unexpected server failure
```

Do not return HTTP 200 for application errors merely to simplify the Frontend.

---

# 13. Validation Rules

Frontend validation improves UX.

Backend validation is authoritative and mandatory.

Never rely only on Frontend validation.

Use Bean Validation where appropriate:

```text
@NotBlank
@NotNull
@Email
@Size
@Min
@Max
```

Validation errors must go through the common exception-response structure.

---

# 14. Exception Handling

Each microservice keeps its own:

```text
AppException
ErrorCode
GlobalExceptionHandler
ApiError
ApiResponse
PageResponse
```

Do not create one runtime `GlobalExceptionHandler` shared across all independent Spring Boot services.

Exception responses must not leak:

- stack traces;
- SQL statements;
- database credentials;
- tokens;
- internal file paths;
- sensitive implementation details.

Unexpected exceptions must be logged server-side.

---

# 15. Security Rules

Security-sensitive code requires conservative changes.

Be especially careful with:

```text
JwtTokenProvider
JwtAuthenticationFilter
SecurityConfig
RefreshTokenService
Gateway AuthenticationFilter
CORS
Axios refresh logic
```

Do not change security behavior during style-only tasks.

Never log:

```text
password
password hash
access token
raw refresh token
JWT secret
API secret
database password
```

---

# 16. Password Rules

Passwords must be stored only as BCrypt hashes.

Use:

```java
BCryptPasswordEncoder
```

Never use:

```text
plain text
MD5
SHA-1
raw SHA-256 password hashing
Base64 as password protection
```

Do not return password hashes in API responses.

---

# 17. Access Token Rules

Access tokens are JWTs.

They are used as:

```http
Authorization: Bearer <accessToken>
```

Keep token claims compatible with the current authentication system.

Do not create another JWT provider when one already exists.

Backend authorization is authoritative.

Frontend role checks are only for user experience and route presentation.

---

# 18. Refresh Token Rules

Current refresh-token design:

```text
opaque random token
32 SecureRandom bytes
URL-safe Base64
HttpOnly cookie
SHA-256 hash stored in database
rotation on refresh
revoke on logout
```

Never:

- store raw refresh tokens in the database;
- expose refresh tokens in JSON;
- store refresh tokens in localStorage/sessionStorage;
- read the HttpOnly refresh token from JavaScript;
- accept refresh tokens from request JSON.

Cookie baseline:

```text
HttpOnly = true
SameSite = Lax
Path = /api/v1/auth
Secure = configurable
```

Production over HTTPS should use:

```text
Secure = true
```

Do not remove token rotation or replay protection.

---

# 19. Authentication Behavior

Existing Auth behavior must remain compatible unless the task explicitly changes it.

Current completed features include:

```text
Register
Login
BCrypt
USER / ADMIN roles
Access JWT
/users/me
ProtectedRoute
RoleRoute
Refresh Token
Refresh Rotation
Automatic access-token refresh
Server-side refresh revocation
Logout
Session restore
```

Do not accidentally reimplement these features when working on Course, Learning, Payment, or AI.

---

# 20. API Gateway Rules

Frontend communicates with:

```text
http://localhost:8080
```

during local development.

Gateway responsibilities:

```text
routing
CORS
access-token validation
request logging
identity-header protection
safe gateway errors
```

Gateway must not contain business logic.

Do not implement Course/Auth/Payment business operations in the Gateway.

---

# 21. Frontend Architecture Rules

Use JavaScript and JSX.

Do not introduce TypeScript unless the project explicitly decides to migrate.

Keep the feature-based organization.

Typical structure:

```text
src/
  app/
  layouts/
  routes/

  features/
    auth/
    courses/
    learning/
    payment/
    ai-assistant/

  shared/
    apis/
    components/
    constants/
    hooks/
    utils/

  styles/
```

A feature should keep feature-specific code inside its own folder.

---

# 22. Frontend Axios Rules

There must be only one common Axios instance.

Current location:

```text
frontend/web/src/shared/apis/axiosClient.js
```

Do not create:

```text
axiosClient2.js
apiClient.js
httpClient.js
new axios.create()
```

inside feature modules.

Feature APIs must reuse the shared Axios client.

Flow:

```text
Page / Component
      |
      v
feature API
      |
      v
axiosClient
      |
      v
API Gateway
```

Pages should not perform direct Axios requests unless there is a very specific approved reason.

---

# 23. Frontend Authentication Rules

Reuse:

```text
AuthContext
useAuth
authApi
ProtectedRoute
RoleRoute
storage/token helpers
```

Do not create duplicate authentication contexts.

Do not derive authoritative user data only from decoded JWT contents.

Use `/api/v1/users/me` where server-authoritative user state is required.

---

# 24. Automatic Refresh Rules

Do not break the existing 401 refresh mechanism.

Required behavior:

```text
protected request
      |
      v
401
      |
      v
single refresh request
      |
      v
new access token
      |
      v
retry original request once
```

Requirements:

- only one shared in-flight refresh per frontend instance;
- never infinitely retry;
- Auth endpoints must not recursively trigger refresh;
- failed refresh must clear invalid local authentication state;
- late/stale requests must not restore an ended session.

Style-only tasks must preserve these semantics exactly.

---

# 25. Frontend JavaScript Style

Use:

```text
2 spaces indentation
```

Follow the dominant project convention for:

```text
quotes
semicolons
trailing commas
```

Do not arbitrarily reformat the entire repository into a different convention.

Long objects should be structured clearly.

Prefer:

```javascript
const config = {
  headers: {
    Authorization: `Bearer ${token}`,
  },
  withCredentials: true,
  timeout: 15000,
};
```

rather than dense single-line objects.

---

# 26. JSX Style

Short components with few props may remain on one line.

Components with several props should be expanded.

Prefer:

```jsx
<Button
  variant="contained"
  disabled={loading}
  onClick={handleSubmit}
  fullWidth
>
  Login
</Button>
```

Avoid giant JSX expressions and deeply nested ternaries.

Use helper variables or small helpers when they materially improve readability.

Do not redesign the UI during code-cleanup tasks.

---

# 27. Material UI Rules

Material UI is the main UI component library.

Reuse the existing:

```text
theme
layout components
shared components
design tokens
```

Do not mix in another major UI framework without explicit approval.

Avoid large repeated inline `sx` objects.

Extract styles when:

- reused;
- conceptually meaningful;
- too large to read inline.

---

# 28. Routing Rules

Reuse the existing router and route constants.

Do not hard-code route strings across many components if a route constant already exists.

Use guards appropriately:

```text
ProtectedRoute
RoleRoute
```

Do not treat frontend route guards as a substitute for backend authorization.

---

# 29. Environment Variables

Never commit real secrets.

Frontend may contain only non-sensitive `VITE_*` variables.

Example:

```env
VITE_API_URL=http://localhost:8080
```

Backend secrets belong in environment variables.

Examples:

```text
MYSQL_ROOT_PASSWORD
AUTH_DB_PASSWORD
COURSE_DB_PASSWORD
LEARNING_DB_PASSWORD
PAYMENT_DB_PASSWORD
AI_DB_PASSWORD
JWT_SECRET
VNPAY_TMN_CODE
VNPAY_HASH_SECRET
AWS_REGION
AWS_S3_BUCKET
AI_API_KEY
```

Do not place sensitive values in React.

---

# 30. Docker Rules

The main Compose file is:

```text
compose.yaml
```

Useful commands:

```powershell
docker compose up -d mysql
```

Run the complete backend:

```powershell
docker compose --profile backend up --build -d
```

Check:

```powershell
docker compose --profile backend ps
```

Only the API Gateway should normally be exposed as the backend entry point for the browser.

Do not expose every internal microservice without a specific development need.

---

# 31. Testing Rules

Every functional change must preserve existing tests.

Frontend:

```powershell
npm run build
npm run lint
npm test
```

Backend:

```powershell
mvn -f backend/pom.xml verify
```

For service-specific work, also run the specific service verify command.

Example:

```powershell
mvn -f backend/auth-service/pom.xml verify
```

Docker/runtime-sensitive tasks should additionally verify:

```powershell
docker compose --profile backend up --build -d
docker compose --profile backend ps
```

Do not report an E2E flow as successful unless it was actually executed.

---

# 32. Test Quality Rules

Do not:

- delete failing tests to make a task pass;
- weaken assertions merely to accept broken behavior;
- replace meaningful tests with mocks when the task requires real integration;
- claim MySQL runtime success based only on H2 tests.

Use:

```text
unit tests
integration tests
Gateway tests
Frontend tests
real E2E tests
```

as appropriate to the feature.

---

# 33. Logging Rules

Use structured and meaningful logs.

Good:

```java
log.warn("Request rejected code={}", errorCode);
```

Bad:

```java
System.out.println(exception);
```

Never log secrets or raw authentication credentials.

Use:

```text
DEBUG for development detail
INFO for meaningful lifecycle/business events
WARN for handled abnormal cases
ERROR for unexpected failures
```

Do not flood logs with routine successful requests unless needed.

---

# 34. Comments and Documentation

Comments should explain why, not restate what obvious code already says.

Good comment topics:

- concurrency protection;
- security decisions;
- framework edge cases;
- compatibility constraints;
- non-obvious business rules.

Keep API behavior documented in:

```text
docs/API_CONVENTIONS.md
README.md
feature completion reports when requested
```

Do not let documentation contradict actual source behavior.

---

# 35. Git Rules

Do not commit:

```text
.env
node_modules/
target/
IDE temp files
logs
screenshots generated by tests
real secrets
```

Recommended workflow:

```text
feature/<feature-name>
fix/<issue-name>
refactor/<scope>
```

Keep commits focused when possible.

Do not mix unrelated features into one change.

---

# 36. AI / Agent Rules

Before writing code, an Agent must:

1. inspect the existing folder tree;
2. inspect files relevant to the requested task;
3. reuse existing infrastructure;
4. identify duplicate-risk areas;
5. understand existing tests.

The Agent must not assume a file is missing without searching first.

The Agent must not create a duplicate implementation just because the requested prompt uses a different filename.

Example:

If the project already has:

```text
shared/apis/axiosClient.js
```

do not create:

```text
shared/api/axiosClient.js
```

If the project already has:

```text
authValidation.js
```

do not create another:

```text
authSchema.js
```

unless a real architectural reason exists.

---

# 37. AI Scope Discipline

For every task, the Agent must distinguish:

```text
REQUESTED
OPTIONAL
OUT OF SCOPE
```

Do not implement out-of-scope features automatically.

Examples:

A Course Catalog task must not silently add:

```text
VNPay
OAuth2
password reset
AI Tutor
AWS deployment
```

unless explicitly requested.

---

# 38. AI Reporting Rules

At the end of a significant task, report:

```text
CREATED
MODIFIED
REUSED
DATABASE MIGRATIONS
API ENDPOINTS
TEST RESULTS
DOCKER RESULTS
E2E RESULTS
WARNINGS
NEXT RECOMMENDED TASK
```

Only include sections relevant to the task.

Do not claim:

```text
PASS
E2E SUCCESS
RUNNING
VERIFIED
```

without actual evidence.

Clearly state anything that could not be tested.

---

# 39. Style-Only Task Rules

When the task is formatting/readability cleanup:

Allowed:

```text
whitespace
line wrapping
import cleanup
descriptive local/private names
small equivalent helper extraction
formatter configuration
```

Not allowed:

```text
API behavior changes
database changes
security changes
JWT changes
cookie changes
routing changes
business-rule changes
UI redesign
```

If a style refactor causes test failure, revert the refactor rather than altering behavior.

---

# 40. Feature Development Order

Prefer vertical slices that run end-to-end.

Example:

```text
React
  |
  v
feature API
  |
  v
Gateway
  |
  v
Service
  |
  v
Database
```

A feature is stronger when its full path works than when many disconnected classes exist.

Current roadmap direction:

```text
Foundation                DONE
Auth Register/Login       DONE
Refresh Token             DONE
Course Public Catalog     NEXT
Course Detail
Admin Course Management
Enrollment / Learning
Video / Progress
Quiz
Payment / VNPay
AI Assistant
```

This roadmap is guidance, not a hard restriction if priorities change.

---

# 41. Definition of Done

A task is complete when:

```text
code is readable
architecture is preserved
tests pass
build passes
API contracts are respected
security behavior is preserved
database changes use migrations
documentation is updated when needed
runtime is verified when required
no unrelated feature was introduced
```

For end-to-end features, completion should ideally include:

```text
Frontend
  -> Gateway
  -> Service
  -> Database
  -> Response
  -> Frontend state/UI
```

---

# 42. Final Rule

When uncertain between:

```text
creating something new
```

and:

```text
reusing an existing working component
```

inspect the project first and prefer reuse.

Consistency across the project is more important than introducing a second "cleaner" implementation.
