# In-app Notifications contract

Notifications belong to Learning Service and `learning_db.notifications`.
No additional notification table is introduced. Flyway V2 extends the existing type constraint
and adds a nullable, case-sensitive `event_key` unique per recipient. Existing rows
and legacy types remain valid.

## User API

All user endpoints require the existing access JWT through API Gateway.
REST responses retain `ApiResponse` and the current error envelope.

Base: `/api/v1/learning/notifications`.

| Method | Suffix | Response |
| --- | --- | --- |
| GET | empty | Latest 20 notifications; legacy array contract |
| GET | /feed | `PageResponse<NotificationResponse>` |
| GET | /summary | `{ unreadCount, notifications }`; latest 5 |
| PATCH | /{id}/read | Notification after marking read |
| PATCH | /read-all | Updated summary |
| GET | /stream | `text/event-stream` |

Feed parameters: `page=0`, `size=20` (1–100), optional
`category=COURSE|PAYMENT|LEARNING|SYSTEM`, `unreadOnly=false`.
Order is `createdAt DESC, id DESC`. Invalid parameters return 400.
Missing authentication returns 401. Accessing another user's notification returns
404. Reading an already-read notification leaves `readAt` unchanged.

Notification responses keep `id, type, title, body, actionUrl, read, readAt,
createdAt` and add `category`. Dates are UTC instants; the UI formats them in
Vietnamese with the project's UTC+7 timezone.

| Type | Category | Trigger |
| --- | --- | --- |
| COURSE_ENROLLED | COURSE | New enrollment |
| PAYMENT_SUCCESS | PAYMENT | Paid enrollment command or trusted success event |
| PAYMENT_FAILED | PAYMENT | Trusted failure event |
| PAYMENT_CANCELLED | PAYMENT | Trusted cancellation event |
| PAYMENT_REFUNDED | PAYMENT | Trusted refund event |
| LESSON_COMPLETED | LEARNING | First lesson completion |
| QUIZ_RESULT_AVAILABLE | LEARNING | Successfully graded attempt |
| ENROLLMENT | COURSE | Existing legacy rows |
| PROGRESS / QUIZ | LEARNING | Existing legacy rows |
| SYSTEM | SYSTEM | Existing legacy rows or an ADMIN message to one recipient |

## Admin API

`/api/v1/learning/admin/notifications` requires the existing JWT with the `ADMIN`
role. A USER JWT receives 403; missing authentication receives 401. The admin UI
is `/admin/notifications` and uses the same Gateway/Axios client as the user UI.

- `GET` returns `ApiResponse<PageResponse<AdminNotificationResponse>>`. Filters:
  optional positive `userId`, optional `category`, `unreadOnly=false`, `page=0`,
  `size=20` (1–100). Sorting remains `createdAt DESC, id DESC`.
  Each entry contains the user response fields plus its recipient `userId`.
- `POST` accepts the following body and returns 201 with
  `ApiResponse<NotificationResponse>`:

  ```json
  {
    "eventId": "b99dba41-1692-47b3-a63f-980f3ca07c31",
    "userId": 123,
    "title": "Lịch bảo trì hệ thống",
    "body": "Vui lòng lưu bài làm trước thời gian bảo trì."
  }
  ```

  `eventId` follows the receiver's 1–128 character rule; `userId` must be positive.
  Title and body are required, trimmed, and limited to 255 and 1000 characters.
  The server always chooses `type=SYSTEM`, `category=SYSTEM`, and the relative
  `actionUrl=/notifications`; the caller cannot create payment/learning outcomes
  or supply another destination.
- The event key is `admin:system:<eventId>` and is unique per recipient. Retrying
  the same message returns 201 with the original ID and read state. Reusing that
  identity with different title/body returns 409. The UI keeps the same eventId
  after a transport failure and creates another only after editing or a successful send.
- New messages participate in the existing local transaction and recipient SSE
  after commit. Rollback stores no message and publishes no change.
- The first version sends to one explicitly entered ID. It does not query Auth's
  database to validate/list accounts, broadcast, schedule, or introduce new roles
  and permissions. Admins cannot edit/delete business notifications or mark the
  recipient's messages as read through these admin endpoints.

This reuses the current SYSTEM type and notification table; no migration is needed.

## Server-to-server receiver

`POST /internal/v1/notifications/events` is served directly by Learning Service,
not routed by Gateway and never called by frontend.

Configure `NOTIFICATION_EVENT_API_KEY` on Learning Service and pass its exact
value in `X-Notification-Key`. Use a long random value (at least 32 random bytes)
and HTTPS on any untrusted network. Keep the value out of browser code, request
logs and source control. Empty configuration disables the receiver (503).
Missing or wrong key returns 401, including requests with a valid user/admin JWT.
Compose forwards only this environment variable to Learning Service.

Payment example:

```json
{
  "eventId": "LS-PAY-EXAMPLE",
  "userId": 123,
  "type": "PAYMENT_SUCCESS",
  "orderCode": "LS-PAY-EXAMPLE"
}
```

Course example:

```json
{
  "eventId": "enrollment-confirmed-456",
  "userId": 123,
  "type": "COURSE_ENROLLED",
  "courseId": 42
}
```

- `eventId` is stable across retries and identifies one business event, not one
  HTTP delivery. Allowed characters: letters, digits, dot, underscore, colon,
  hyphen; length 1–128, starting with a letter or digit.
- `userId` is required and positive. COURSE_ENROLLED requires a positive
  `courseId`; PAYMENT_* requires `orderCode` (1–100 letters/digits/dot/underscore/
  hyphen, starting with a letter or digit).
- Only the COURSE_ENROLLED and four PAYMENT types are accepted externally.
- Return 200 with the saved notification. Repeating the same recipient/type/
  eventId returns the existing ID, original content, creation time and read state.
  Concurrent delivery uses an atomic database upsert.
- Sender derives the recipient and state from committed backend business data,
  never browser-provided payment status. Send only after successful commit.
  Retry transport failures/5xx with the same eventId; fix 4xx before retrying.
- The receiver creates notifications only. It does not enroll users, confirm
  payments or query another service's database.
- Learning automatically notifies on its own enrollments. A sender should avoid
  delivering a second enrollment event for the same operation through this API.
- `POST /internal/v1/learning/enrollments` now creates both the enrollment and its
  PAYMENT_SUCCESS notification atomically. Payment's existing enrollment client
  already invokes this endpoint for SUCCESS. Do not send a second success event;
  if replaying through the notification receiver, use `eventId = orderCode` to
  share the same notification identity. Other payment states remain notification-only.
- Course publishers, other payment status publishers and reliable delivery from
  those services remain their owners' responsibility. The enrollment receipt table
  added by Flyway V4 tracks processed orders; it does not replace the notifications table.

Titles, bodies and relative action URLs are generated by Learning Service.
Course and lesson notifications open `/learning/{courseId}`; quiz notifications
open `/quizzes/attempts/{attemptId}/result`; payment notifications open
`/payment/result?orderCode=...`.

## Realtime lifecycle

The stream uses the current JWT in an Authorization header. Frontend consumes it
using the shared Axios client's fetch adapter (`responseType: stream`,
`timeout: 0`, AbortController); all regular REST calls keep their existing timeout.

- `connected` and `notifications-changed` events contain `data: {}`.
- A comment heartbeat is sent every 15 seconds.
- Each connection ends after 240 seconds or at JWT expiry, whichever comes first.
- Changes are published to the recipient's connections only after commit.
  Rollback publishes nothing; failed stream delivery cannot fail a saved operation.
- Frontend reloads the summary/current feed on connection or change and reconnects
  with 1, 2, 4, 8, 16, then 30 second delays. Existing Axios refresh handles 401.
- One connection is owned by the provider per tab, across route transitions.
  Logout/account changes cancel it and hide the previous recipient's data.
- There is no event replay: REST/database state is authoritative after reconnect.
  The initial implementation uses one Learning Service instance. Multiple replicas
  require shared event distribution before realtime can be guaranteed.
- No demo fallback is used for notification data; errors offer retry.

## Verification

```powershell
cd backend/learning-service
.\mvnw.cmd -B verify

cd ../../frontend/web
npm test
npm run lint
npm run build
```

`NotificationIntegrationTests` runs HTTP/SSE, ownership, legacy type, pagination,
retry/concurrency, rollback, heartbeat, expiry and cleanup checks against H2 by
default. To validate the actual Flyway migrations and schema with MySQL, provision
an isolated, empty test database and set:

```text
NOTIFICATION_TEST_MYSQL_URL=jdbc:mysql://127.0.0.1:3306/<isolated_test_database>
NOTIFICATION_TEST_MYSQL_USER=<test_database_user>
NOTIFICATION_TEST_MYSQL_PASSWORD=<test_database_password>
```

Then run `mvnw.cmd -B -Dtest=NotificationIntegrationTests test`.
With these variables the test uses MySQL, Flyway and `ddl-auto=validate`.
Never point this suite at a shared development or production database.

`C11NotificationIntegrationTests` additionally checks ADMIN authorization,
recipient/category/unread pagination, payload/filter validation, SYSTEM-only
send, retry/conflict/read preservation, concurrent requests and rollback.
`frontend/web/tests/notifications.test.js` checks split SSE frames and UTF-8,
abort cleanup, safe links, StrictMode stream cleanup, logout/account isolation,
summary/read races, user filters and stable admin-send retry identities.
