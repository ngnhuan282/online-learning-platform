# Payment Week 1 Contract

Scope: D1 / Week 1 for TV4. This locks the backend foundation and API shape for
Order/Payment without integrating a real provider yet. Checkout, result pages and
admin analytics UI are intentionally not implemented until a UI mockup is provided.

## Database

Payment Service owns `payment_db` and uses Flyway.

Tables introduced in `V1__create_payment_schema.sql`:

- `orders`: user-owned order snapshot, amount, currency, status and expiry.
- `order_items`: course snapshot at checkout time. Frontend does not send price.
- `payments`: provider attempt/status for an order.
- `payment_transactions`: audit trail for provider events and state transitions.

Status enums:

- `OrderStatus`: `PENDING_PAYMENT`, `PAID`, `CANCELLED`, `EXPIRED`.
- `PaymentStatus`: `PENDING`, `SUCCESS`, `FAILED`, `CANCELLED`, `REFUNDED`.
- `PaymentProvider`: `MOCK`, `VNPAY`.

## API Contract

All endpoints are under `/api/v1/payments` and require a valid access token unless
a later VNPay callback task explicitly opens a signed guest callback route.

Current week-1 behavior: protected routes exist and return the standard error
envelope with `FEATURE_NOT_IMPLEMENTED` until D2/D3/D5 fill in business logic.

| Method | Path                        | Role       | Purpose                                                          |
| ------ | --------------------------- | ---------- | ---------------------------------------------------------------- |
| POST   | `/checkout`                 | USER/ADMIN | Create a checkout from `courseId`; backend verifies price later. |
| GET    | `/orders/{orderCode}`       | USER/ADMIN | Read one order/payment result.                                   |
| GET    | `/history?page=0&size=20`   | USER/ADMIN | User payment history.                                            |
| GET    | `/admin/orders/{orderCode}` | ADMIN      | Admin transaction detail.                                        |
| GET    | `/admin/analytics`          | ADMIN      | Admin payment analytics cards/charts.                            |

Checkout request:

```json
{
  "courseId": 101,
  "provider": "MOCK",
  "returnUrl": "http://localhost:5173/payment/result",
  "cancelUrl": "http://localhost:5173/payment/cancel"
}
```

Rules:

- `courseId` is required.
- `amount`, `price`, `status`, `userId` and `paidAt` are never accepted from the frontend.
- D6 will verify course price with Course Service before payment creation.
- D9 will add VNPay signed return/callback verification.

## UI Pending Mockup

Waiting for user-provided mockups before frontend implementation:

- Checkout page.
- Payment Success / Failed / Result state.
- User Payment History.
- Admin Analytics skeleton.
