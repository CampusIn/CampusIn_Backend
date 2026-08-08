# CampusIn k6 Load Tests

This directory contains a **separate load-testing suite** for the existing Express backend.

It uses real endpoints from:

- `src/app.js`
- `src/routes/*.js`
- `CampusIn.postman_collection.json`

No backend application code is modified by these tests.

## 1) Install k6

macOS (Homebrew):

```bash
brew install k6
```

Verify:

```bash
k6 version
```

## 2) Directory layout

```text
load-tests/
├── config.js
├── helpers/
│   ├── auth.js
│   └── checks.js
└── scenarios/
    ├── public.js
    ├── user.js
    ├── mixed-user.js
    ├── vendor.js
    ├── admin.js
    ├── delivery.js
    └── rate-limit.js
```

## 3) Environment variables

Required for authenticated scenarios:

- `BASE_URL` (default: `http://localhost:3000`)
- `TEST_USER_EMAIL`
- `TEST_USER_EMAILS` (optional comma-separated user pool)
- `TEST_USER_PASSWORD`
- `TEST_USER_PASSWORDS` (optional comma-separated password pool)
- `TEST_USERS_JSON` (optional JSON user pool: `[{"email":"u1@example.com","password":"..."}]`)
- `TEST_VENDOR_EMAIL`
- `TEST_VENDOR_PASSWORD`
- `TEST_ADMIN_EMAIL`
- `TEST_ADMIN_PASSWORD`
- `TEST_DELIVERY_EMAIL`
- `TEST_DELIVERY_PASSWORD`

Optional tuning:

- `TEST_TYPE` = `smoke` | `load` | `stress` | `spike`
- `TARGET_VUS` (for load profile target, e.g. `10`, `50`, `200`)
- `LOAD_STAGE_DURATION` (default `1m`)
- `LOAD_RAMP_DOWN_DURATION` (default `2m`)
- `STRESS_STAGE_DURATION` (default `1m`)
- `STRESS_RAMP_DOWN_DURATION` (default `2m`)
- `SPIKE_BASELINE_DURATION` (default `1m`)
- `SPIKE_DURATION` (default `30s`)
- `SPIKE_RECOVERY_DURATION` (default `2m`)
- `SMOKE_RAMP_UP_DURATION` (default `15s`)
- `SMOKE_HOLD_DURATION` (default `30s`)
- `SMOKE_RAMP_DOWN_DURATION` (default `15s`)
- `ENABLE_CART_WRITES` (default `false`, opt-in)
- `CART_WRITE_EVERY_N_ITER` (default `5`)
- `AUTH_TOKEN_TTL_MS` (default `780000` ms, ~13m login reuse window)
- `AUTH_REAUTH_COOLDOWN_MS` (default `30000` ms, avoids re-login loops on repeated 401s)
- `USE_VU_IP_DISTRIBUTION` (default `true`, sends unique `x-forwarded-for` per VU)
- `THRESHOLD_ERROR_RATE` (default `0.01`)
- `THRESHOLD_P95_MS` (default `500`)
- `THRESHOLD_P99_MS` (default `1000`)
- `MIXED_WRITE_ENABLED` (default: `false` for smoke, `true` otherwise)
- `ALLOW_SHARED_TEST_USERS` (default: `true`; set `false` to enforce strict one-account-per-VU capacity checks)
- `TEST_RESTAURANT_ID` / `TEST_RESTAURANT_IDS`
- `TEST_MENU_ITEM_ID` / `TEST_MENU_ITEM_IDS`
- `TEST_MARKETPLACE_PRODUCT_ID` / `TEST_MARKETPLACE_PRODUCT_IDS`

## 4) Authentication model

- Role logins use real endpoints:
  - `POST /api/auth/user/login`
  - `POST /api/auth/vendor/login`
  - `POST /api/auth/admin/login`
  - `POST /api/auth/delivery-partner/login`
- Access token path parsed from response: `data.accessToken`
- Requests include: `Authorization: Bearer <token>`
- Credentials are assigned deterministically per VU using `__VU`:
  - VU 1 -> pool item 1, VU 2 -> pool item 2, ...
  - if VUs exceed pool size, assignment cycles unless blocked by `ALLOW_SHARED_TEST_USERS=false`
- Tokens are cached per role and per assigned VU credential within each VU runtime.
- On a `401`, the helper retries once with a forced re-login and applies a cooldown before another forced re-login.
- `user.js` does not perform authenticated `setup()` calls, so logins are VU-scoped at runtime.

## 5) Scenarios

## `public.js`

Read-only public traffic:

- `GET /health`
- `GET /api/restaurants`
- `GET /api/restaurant/:id`
- `GET /api/restaurants/:restaurantId/menu`
- `GET /api/restaurants/menu/:id`
- `GET /api/user/restaurants/:restaurantId/reviews`

## `user.js`

Authenticated user journey (safe baseline):

- login + `GET /api/auth/me`
- homepage: banners + announcements
- restaurant browse/list/detail/menu/reviews
- cart reads by default; optional controlled cart add/update when explicitly enabled
- marketplace categories/products/product detail/suggestions
- marketplace cart read

## `vendor.js`

Read-heavy vendor endpoints:

- dashboard metrics
- inventory + low stock
- vendor order list + optional order detail
- vendor platform settings

## `mixed-user.js`

Authenticated mixed read/write traffic for safe operations:

- read/browse traffic
- cart reads
- controlled cart add/update traffic
- safe cleanup deletes of test-touched cart items
- no orders, payments, OTP, password-reset, or other destructive flows

Workload mix by iteration:

- `60%` read_browse
- `20%` cart_read
- `15%` cart_write
- `5%` cleanup

Cart write and cleanup notes:

- writes are disabled automatically in smoke unless `MIXED_WRITE_ENABLED=true`
- cart-write operations run a bounded lifecycle to avoid unbounded cart growth:
  - `GET cart -> add/update -> GET cart -> update -> GET cart -> delete -> GET cart`
- cleanup deletes one currently-present item per cart type (if any)
- script does not call `DELETE /api/user/cart` or `DELETE /api/marketplace/cart` by default
- by default, stateful writes continue with a warning when user pool size is smaller than profile max VUs
- set `ALLOW_SHARED_TEST_USERS=false` to fail fast and enforce strict user isolation

## `admin.js`

Read-heavy admin endpoints:

- dashboard + dashboard slices
- settings view
- coupons, announcements, banners (read)
- food order list + optional detail
- marketplace dashboard + order list + optional detail

## `delivery.js`

Read-heavy delivery endpoints:

- delivery food order list + optional detail
- delivery marketplace order list + optional detail

## `rate-limit.js`

Dedicated rate-limit verification scenario (separate from normal load):

- intentionally probes `POST /api/auth/user/login` strict limiter
- expects 429 once per-IP threshold is crossed

## 6) Dynamic IDs (no invented IDs)

IDs are discovered from real API responses at runtime:

- `restaurantId` from `GET /api/restaurants`
- `menuItemId` from `GET /api/restaurants/:restaurantId/menu`
- `productId` from `GET /api/marketplace/products`
- `orderId` from role-specific list endpoints

If an ID cannot be discovered, detail/write operations are skipped for that iteration.

## 7) Test profiles

## Smoke

- Low traffic for script validation.

```bash
k6 run -e TEST_TYPE=smoke load-tests/scenarios/user.js
```

## Load

- Baseline load profile ramps through `10 -> 25 -> 50 -> 100 -> 150 -> 200`, then ramps down.

```bash
k6 run -e TEST_TYPE=load load-tests/scenarios/user.js
```

Run exact load target with the same profile logic:

```bash
k6 run -e TEST_TYPE=load -e TARGET_VUS=10 load-tests/scenarios/user.js
k6 run -e TEST_TYPE=load -e TARGET_VUS=25 load-tests/scenarios/user.js
k6 run -e TEST_TYPE=load -e TARGET_VUS=50 load-tests/scenarios/user.js
k6 run -e TEST_TYPE=load -e TARGET_VUS=100 load-tests/scenarios/user.js
k6 run -e TEST_TYPE=load -e TARGET_VUS=150 load-tests/scenarios/user.js
k6 run -e TEST_TYPE=load -e TARGET_VUS=200 load-tests/scenarios/user.js
```

## Stress

- Gradually exceeds expected max load to find degradation:
  `50 -> 100 -> 150 -> 200 -> 250 -> 300`.

```bash
k6 run -e TEST_TYPE=stress load-tests/scenarios/user.js
```

## Spike

- Sudden surge behavior test:
  baseline 20 VUs, spike to 250, recover.

```bash
k6 run -e TEST_TYPE=spike load-tests/scenarios/user.js
```

## 8) Example with full env vars

```bash
k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e TEST_TYPE=smoke \
  -e TEST_USER_EMAIL=your-user@example.com \
  -e TEST_USER_EMAILS=user1@example.com,user2@example.com \
  -e TEST_USER_PASSWORD=your-user-password \
  -e TEST_USER_PASSWORDS=password1,password2 \
  -e TEST_VENDOR_EMAIL=your-vendor@example.com \
  -e TEST_VENDOR_PASSWORD=your-vendor-password \
  -e TEST_ADMIN_EMAIL=your-admin@example.com \
  -e TEST_ADMIN_PASSWORD=your-admin-password \
  -e TEST_DELIVERY_EMAIL=your-delivery@example.com \
  -e TEST_DELIVERY_PASSWORD=your-delivery-password \
  load-tests/scenarios/user.js
```

## 9) NPM scripts

From repo root:

```bash
npm run test:load:smoke
npm run test:load
npm run test:load:stress
npm run test:load:spike
npm run test:load:public
npm run test:load:vendor
npm run test:load:admin
npm run test:load:delivery
npm run test:load:mixed
npm run test:load:mixed:smoke
```

Add env vars inline when running scripts, for example:

```bash
BASE_URL=http://localhost:3000 TEST_TYPE=load TARGET_VUS=50 npm run test:load
```

Mixed workload examples:

```bash
k6 run \
  -e TEST_TYPE=load \
  -e TARGET_VUS=50 \
  -e BASE_URL="$BASE_URL" \
  -e TEST_MENU_ITEM_IDS=id1,id2,id3 \
  -e TEST_MARKETPLACE_PRODUCT_IDS=id1,id2,id3 \
  load-tests/scenarios/mixed-user.js

k6 run \
  -e TEST_TYPE=smoke \
  -e BASE_URL="$BASE_URL" \
  load-tests/scenarios/mixed-user.js
```

## 10) Checks and thresholds

Each scenario applies reusable checks for:

- expected status codes
- JSON response shape
- `success === true`
- presence of `data` where expected

Default thresholds (configurable via env vars):

- `http_req_failed: rate < 1%`
- `http_req_duration: p(95) < 500ms`
- `http_req_duration: p(99) < 1000ms`
- `checks: rate > 95%`

## 11) Metrics and diagnosis

All requests are tagged with:

- `scenario` (public/user/mixed-user/vendor/admin/delivery)
- `operation` (business step)
- `endpoint` (route identity)
- `test_type` (smoke/load/stress/spike)
- `vu` (k6 virtual user id)
- `user_pool_index` (assigned credential index)
- `auth_logins_total` counter is emitted with `role` and `scenario` tags to verify login frequency.
- `rate_limit_429` counter is emitted when a response matches rate-limit characteristics (`429` + `Retry-After`/`retryAfter`).
- mixed-user counters: `cart_add_success`, `cart_update_success`, `cart_delete_success`, `cart_operation_errors`.
- mixed-user marketplace counters: `marketplace_cart_add_success`, `marketplace_cart_update_success`, `marketplace_cart_delete_success`, `marketplace_cart_operation_errors`.

Use these tags to isolate latency/error sources per endpoint and scenario.

## 12) How to read results

- **p95**: 95% of requests finish below this latency.
- **p99**: 99% of requests finish below this latency (tail latency).
- **error rate** (`http_req_failed`): failed HTTP requests ratio.
- **requests/sec**: throughput capacity under current load shape.

## 13) Safety notes

- Do **not** run high-load tests against production without explicit intent.
- Set `BASE_URL` intentionally for every run.
- Use dedicated test accounts and test data.
- Baseline suite intentionally excludes destructive loops.

Excluded by default:

- order creation/cancellation loops
- marketplace order creation/cancellation loops
- admin write endpoints
- vendor stock updates and bulk uploads
- delivery status transitions
- registration, OTP, and password-reset flows
- payment APIs in mixed workload

Rate-limit-specific test (opt-in):

```bash
k6 run load-tests/scenarios/rate-limit.js
```

Note: cart write operations are also disabled by default. Enable only if you explicitly want write traffic:

```bash
k6 run -e TEST_TYPE=load -e ENABLE_CART_WRITES=true load-tests/scenarios/user.js
```

When cart writes are enabled, the script updates an existing cart item first (if present) to avoid unbounded cart growth. If the cart is empty, it may add one item and normalize quantity to 1.
