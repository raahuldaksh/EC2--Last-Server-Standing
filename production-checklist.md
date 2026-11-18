# Production Pre-Flight Checklist
# Last Server Standing — High-Performance Flash Sale API

---

## Pre-Flight Verification Checklist (Official Section 11)

- [x] **1. Port Binding:** `ss -tlnp | grep 8080` confirms listening on `0.0.0.0:8080` (or `*:8080`), never `127.0.0.1:8080`.
- [x] **2. Health Check:** `curl -i http://localhost:8080/health` returns `200 OK` with `{"status":"ok"}`.
- [x] **3. Local Database:** Database files live locally on disk (`data/shop.db` with WAL mode). No external cloud database or Atlas connection strings exist in code.
- [x] **4. Crash Recovery:** Killing the server process (`sudo kill -9 <pid>`) results in automatic systemd restart within $< 1\text{ s}$, preserving all committed stock and orders.
- [x] **5. Zero Internet at Restart:** Restarting the application requires no internet access (no `npm install`, `git pull`, or image pulls).
- [x] **6. No Dev Watchers:** Production runs without `nodemon`, `--reload`, or development watchers.
- [x] **7. Exact Status & Error Codes:** Verified 100% against official Section 04:
  - `400 VALIDATION_ERROR`
  - `404 PRODUCT_NOT_FOUND`
  - `409 PRODUCT_EXISTS`
  - `409 ALREADY_PURCHASED`
  - `409 SOLD_OUT`
- [x] **8. Concurrency Test A (Last Unit):** 50 concurrent buyers for 1 unit yields **exactly one 201** and 49 `409 SOLD_OUT` responses. Final stock = 0.
- [x] **9. Concurrency Test B (Double-Click):** 20 simultaneous duplicate orders from the same user yields **exactly one 201** and 19 `409 ALREADY_PURCHASED` responses. Final stock = 999.
- [x] **10. No Rate Limiting:** No IP-based rate limiting exists to block benchmark traffic.
- [x] **11. Minimal Logging:** Zero per-request console logging in production.
- [x] **12. Durability & Reconciliation:** `npm run test:reconciliation` audits all database rows and confirms 0 violations.
