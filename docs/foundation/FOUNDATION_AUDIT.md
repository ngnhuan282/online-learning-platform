# Common foundation audit

Scope: the attached task takes precedence over the broader v1.2 specification. Use JavaScript/JSX and Material UI; do not implement business features or new pages.

## Existing and reusable

- Frontend: React 19, Vite 8, Material UI 9, Axios, React Router; all required frontend dependencies are already installed.
- `src/app/App.jsx`, `router.jsx`, `layouts/MainLayout.jsx`, existing auth forms, validation, public pages, CSS, demo course data and visual assets are reusable.
- `shared/apis/axiosClient.js` is the only existing Axios instance. Keep the existing `apis` directory and extend this client rather than creating a duplicate `api` directory.
- `features/auth/schemas/authValidation.js` already implements form validation and password strength. Reuse this filename and implementation.
- `MainLayout.jsx` already serves as PublicLayout. Keep its name and design.
- Backend: six independent Maven projects, Spring Boot 4.1.1, Java 21; preserve all `com.elearning.<service>` packages and application classes.
- Business services already include MVC, validation, JPA, MySQL and actuator. Auth includes Spring Security. Each service has a generated context test.

## Missing or incomplete

- Providers, theme, auth state, token/error/formatting helpers, guards, shared state components and auth API adapter.
- `AdminLayout.jsx`, `storage.js`, `routes.js`, `ForbiddenPage.jsx`, `NotFoundPage.jsx` are empty placeholders. The last two will remain unused because this task excludes new pages.
- All service common response/exception classes, JWT infrastructure and security response handlers.
- Gateway has routing YAML but no Spring Cloud Gateway dependency, filters or error handler.
- Root README, gitignore, editorconfig and environment template.

## Defects and duplication risk

- Routes use `/api/...` instead of `/api/v1/...`.
- Learning Service contains a properties assignment in a YAML file. Course Service duplicates Learning Service's name, port 8083 and learning_db settings.
- Database passwords are hard-coded as fallback values. SQL grants one account access to all five databases.
- No duplicate Java classes or competing API clients currently exist. Avoid introducing aliases or second implementations for MainLayout, auth validation and Axios.
- No `.git` repository metadata is available in this workspace, so a file hash inventory is used for the final change report.

## Dependency changes planned

- Gateway: Spring Cloud BOM 2025.1.2 and Gateway WebFlux starter (compatible with Boot 4.1), JWT library and test support.
- Services: JJWT API/runtime for signed access tokens, Spring Security where absent, H2 in test scope for independent context verification.
- No OAuth2 login, shared entity/repository module, frontend dependency, external AI/payment/storage SDK, or business controller.

Compatibility references: [Spring Cloud release matrix](https://cloud.spring.io/), [JJWT documentation](https://github.com/jwtk/jjwt), [Boot 4 Jackson migration](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide).

## Source inventory before changes

Generated dependencies, build output, local browser profiles and environment secrets are excluded.

`	ext
backend/.gitignore
backend/ai-service/.gitattributes
backend/ai-service/.gitignore
backend/ai-service/.mvn/wrapper/maven-wrapper.properties
backend/ai-service/HELP.md
backend/ai-service/mvnw
backend/ai-service/mvnw.cmd
backend/ai-service/pom.xml
backend/ai-service/src/main/java/com/elearning/ai/AiServiceApplication.java
backend/ai-service/src/main/resources/application.yml
backend/ai-service/src/test/java/com/elearning/ai/AiServiceApplicationTests.java
backend/api-gateway/.gitattributes
backend/api-gateway/.gitignore
backend/api-gateway/.mvn/wrapper/maven-wrapper.properties
backend/api-gateway/HELP.md
backend/api-gateway/mvnw
backend/api-gateway/mvnw.cmd
backend/api-gateway/pom.xml
backend/api-gateway/src/main/java/com/elearning/gateway/ApiGatewayApplication.java
backend/api-gateway/src/main/resources/application.yml
backend/api-gateway/src/test/java/com/elearning/gateway/ApiGatewayApplicationTests.java
backend/auth-service/.gitattributes
backend/auth-service/.gitignore
backend/auth-service/.mvn/wrapper/maven-wrapper.properties
backend/auth-service/HELP.md
backend/auth-service/mvnw
backend/auth-service/mvnw.cmd
backend/auth-service/pom.xml
backend/auth-service/src/main/java/com/elearning/auth/AuthServiceApplication.java
backend/auth-service/src/main/resources/application.yml
backend/auth-service/src/test/java/com/elearning/auth/AuthServiceApplicationTests.java
backend/course-service/.gitattributes
backend/course-service/.gitignore
backend/course-service/.mvn/wrapper/maven-wrapper.properties
backend/course-service/HELP.md
backend/course-service/mvnw
backend/course-service/mvnw.cmd
backend/course-service/pom.xml
backend/course-service/src/main/java/com/elearning/course/CourseServiceApplication.java
backend/course-service/src/main/resources/application.yml
backend/course-service/src/test/java/com/elearning/course/CourseServiceApplicationTests.java
backend/learning-service/.gitattributes
backend/learning-service/.gitignore
backend/learning-service/.mvn/wrapper/maven-wrapper.properties
backend/learning-service/HELP.md
backend/learning-service/mvnw
backend/learning-service/mvnw.cmd
backend/learning-service/pom.xml
backend/learning-service/src/main/java/com/elearning/learning/LearningServiceApplication.java
backend/learning-service/src/main/resources/application.yml
backend/learning-service/src/test/java/com/elearning/learning/LearningServiceApplicationTests.java
backend/payment-service/.gitattributes
backend/payment-service/.gitignore
backend/payment-service/.mvn/wrapper/maven-wrapper.properties
backend/payment-service/HELP.md
backend/payment-service/mvnw
backend/payment-service/mvnw.cmd
backend/payment-service/pom.xml
backend/payment-service/src/main/java/com/elearning/payment/PaymentServiceApplication.java
backend/payment-service/src/main/resources/application.yml
backend/payment-service/src/test/java/com/elearning/payment/PaymentServiceApplicationTests.java
frontend/web/.env.example
frontend/web/.gitignore
frontend/web/README.md
frontend/web/eslint.config.js
frontend/web/index.html
frontend/web/package-lock.json
frontend/web/package.json
frontend/web/public/favicon.svg
frontend/web/public/icons.svg
frontend/web/public/images/backend-architecture.svg
frontend/web/public/images/english-ielts.jpg
frontend/web/public/images/english-speaking.jpg
frontend/web/public/images/english-toeic.jpg
frontend/web/public/images/english-workplace.jpg
frontend/web/public/images/frontend-workspace.jpg
frontend/web/public/images/fullstack-architecture.svg
frontend/web/public/images/java-book.jpg
frontend/web/src/app/App.jsx
frontend/web/src/app/router.jsx
frontend/web/src/assets/hero.png
frontend/web/src/assets/react.svg
frontend/web/src/assets/vite.svg
frontend/web/src/features/ai-assistant/components/AiTutorSection.jsx
frontend/web/src/features/auth/components/AuthField.jsx
frontend/web/src/features/auth/components/AuthForm.jsx
frontend/web/src/features/auth/components/ForgotPasswordDialog.jsx
frontend/web/src/features/auth/components/SocialAuthButtons.jsx
frontend/web/src/features/auth/pages/LoginPage.jsx
frontend/web/src/features/auth/pages/RegisterPage.jsx
frontend/web/src/features/auth/schemas/authValidation.js
frontend/web/src/features/auth/styles/auth.css
frontend/web/src/features/courses/components/CourseCard.jsx
frontend/web/src/features/courses/components/FeaturedCourses.jsx
frontend/web/src/features/courses/data/demoCourses.js
frontend/web/src/features/courses/pages/CourseListPage.jsx
frontend/web/src/features/home/components/BenefitsSection.jsx
frontend/web/src/features/home/components/CategorySection.jsx
frontend/web/src/features/home/components/HeroSection.jsx
frontend/web/src/index.css
frontend/web/src/layouts/AdminLayout.jsx
frontend/web/src/layouts/MainLayout.jsx
frontend/web/src/main.jsx
frontend/web/src/pages/ForbiddenPage.jsx
frontend/web/src/pages/HomePage.jsx
frontend/web/src/pages/NotFoundPage.jsx
frontend/web/src/shared/apis/axiosClient.js
frontend/web/src/shared/components/Brand.jsx
frontend/web/src/shared/components/Icon.jsx
frontend/web/src/shared/components/PolicyDialog.jsx
frontend/web/src/shared/components/ScrollToSection.jsx
frontend/web/src/shared/components/SiteFooter.jsx
frontend/web/src/shared/components/SiteHeader.jsx
frontend/web/src/shared/constants/routes.js
frontend/web/src/shared/utils/storage.js
frontend/web/vite.config.js
`
