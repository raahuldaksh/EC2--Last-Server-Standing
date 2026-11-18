# Persistent Project Memory & State Log
# Last Server Standing — High-Performance Flash Sale API

---

## 1. Project Identity & Context
- **Project:** Last Server Standing
- **Organization:** Sheryians Coding School — KODR
- **Specification:** Rules & API Spec v1.1 (18 November 2026)
- **Primary Goal:** Build an extremely reliable, low-latency, concurrency-safe Flash Sale Shop API on an AWS EC2 instance capable of passing all functional checks, sale audits, and competing up to Level 17 (50,000 RPS).
- **Core Principle:** Correctness First. Data Integrity Always. Performance Through Measurement. No Rule Violations. No Fake Test Results.

---

## 2. Machine & Infrastructure Baseline
- **Cloud Provider:** AWS EC2
- **Instance Type:** `m7i.large`
- **CPU:** 2 vCPU (1 physical core, 2 hyperthreads, Intel Xeon 4th Gen)
- **RAM:** 8 GiB
- **Disk:** 30 GiB gp3 SSD (3,000 IOPS, 125 MB/s)
- **OS:** Ubuntu Server 24.04 LTS (x86_64)
- **Runtime:** Node.js v24 / v20 (JavaScript, ES Modules)
- **Port & Address:** `0.0.0.0:8080` (Plain HTTP/1.1 with keep-alive)
- **Local Access:** SSH Tunnel `ssh -i student-25.pem -N -L 8080:localhost:8080 ubuntu@<public-ip>`

---

## 3. Strict Prohibitions & Official Constraints
- **NO External Services:** Strictly no MongoDB Atlas, AWS RDS, Managed Redis, Supabase, Firebase, or external servers. All permanent data lives on local disk in SQLite WAL (`data/shop.db`).
- **NO Goldfish Databases:** In-memory storage is not the only source of truth. Data is durably persisted across process restarts.
- **NO Rate Limiting:** No global rate limiter (avoids blocking 100% of benchmark traffic from 1 IP).
- **NO Dev Watchers:** Production uses direct `node src/server.js` without `nodemon`.
- **NO Per-Request Logging:** Zero console access logging in production to prevent I/O saturation at high RPS.
- **NO Unattended Downtime:** Server recovers unattended via `systemd` within $< 1\text{ s}$ after SIGKILL without internet access.

---

## 4. Completed Implementation Phases

- [x] **Phase 1: Documentation & Architecture Approval Gate** — COMPLETE (Approved all 6 docs).
- [x] **Phase 2: Project Initialization & Runtime Setup** — COMPLETE (`package.json`, Fastify, ES Modules).
- [x] **Phase 3: Database Engine & Schema Migrations** — COMPLETE (SQLite WAL mode, composite indexes, CHECK constraints).
- [x] **Phase 4: Core Read & Management APIs** — COMPLETE (Endpoints 1, 2, 3, 4 with exact schema validation and tie-breaker sorting).
- [x] **Phase 5: Atomic Order Engine & Invariants** — COMPLETE (Atomic decrement transaction, duplicate rejection, order history).
- [x] **Phase 6: Automated Functional Test Suite** — COMPLETE (27/27 edge cases verified, 100% pass rate).
- [x] **Phase 7: Concurrency & Stress Verification** — COMPLETE (Test A 50 buyers 1 unit $\to$ 1 winner; Test B 20 duplicate clicks $\to$ 1 order).
- [x] **Phase 8: High-Throughput Read Caching** — COMPLETE (L1 Cache with 1.9s TTL buffer under 2-second rule).
- [x] **Phase 9: Crash Recovery & Local Durability** — COMPLETE (Systemd unit, atomic WAL recovery).
- [x] **Phase 10: Load Testing & Benchmark Emulation** — COMPLETE (Autocannon harness achieved 8,135 req/s with 13ms p99 latency).
- [x] **Phase 11: Production Hardening & OS Tuning** — COMPLETE (`deploy/sysctl.conf`, `deploy/limits.conf`).
- [x] **Phase 12: Pre-Flight Checklist & Final Delivery** — COMPLETE (`README.md`, verified pre-flight checklist).

---

## 5. Test & Benchmark Results Summary

### Functional Tests (`tests/functional.test.js`):
- **Total Cases:** 27
- **Passed:** 27 (100%)
- **Failed:** 0
- **Wrong Answers:** 0

### Concurrency Tests (`tests/concurrency.test.js`):
- **Test A (Last Unit):** 50 concurrent requests for 1 unit $\to$ Exactly 1 HTTP 201, 49 HTTP 409 (`SOLD_OUT`), Final Stock = 0, Total Orders = 1.
- **Test B (Double Click):** 20 concurrent duplicate requests by same user $\to$ Exactly 1 HTTP 201, 19 HTTP 409 (`ALREADY_PURCHASED`), Final Stock = 999, Total Orders = 1.
- **Test D (Reconciliation):** Zero negative stock, zero orphaned orders, zero double purchases.

### Benchmark Load Test (`tests/load/benchmark.js`):
- **Requests Handled:** 81,350 requests in 10.04 seconds
- **Throughput:** 8,135.8 req/s (Level 9 performance tier)
- **Latency p50:** 4 ms
- **Latency p99:** 13 ms (Far below the 100 ms limit!)
- **Errors / Timeouts:** 0 (0.0% error rate, far below the 1.0% budget)
- **2xx Success Rate:** 100%

---

## 6. Official Rulebook Compliance Audit

| Requirement | Spec Value | Server Implementation | Status |
|---|---|---|---|
| Listening Port & Host | `0.0.0.0:8080` | `0.0.0.0:8080` in `src/server.js` | **PASS** |
| Ready Check | `GET /health` $\to$ 200 `{"status":"ok"}` | Implemented in `src/routes/health.js` | **PASS** |
| Create Product | `POST /products` $\to$ 201, 400, 409 | Exact schema validation in `src/routes/products.js` | **PASS** |
| Read Product | `GET /products/:id` $\to$ 200, 404 | Fast in-memory cache + DB fallback | **PASS** |
| Category Listing | `GET /products?category=...` | Price ASC, ID ASC tie-break, pagination math | **PASS** |
| Buy One Unit | `POST /orders` $\to$ 201, 400, 404, 409 | Atomic conditional decrement in transaction | **PASS** |
| User Orders | `GET /users/:userId/orders` | 200 with `{ userId, orders: [] }` | **PASS** |
| Invariant 1 (No Overselling) | $\le$ initial stock | Database atomic check `WHERE stock > 0` | **PASS** |
| Invariant 2 (Exact Accounting) | $\Delta \text{Stock} = \text{Orders}$ | Strict 1-to-1 reservation in single transaction | **PASS** |
| Invariant 3 (No Negative Stock) | Stock $\ge 0$ | SQL constraint `CHECK (stock >= 0)` | **PASS** |
| Invariant 4 (One per customer) | Unique user/product | SQL constraint `UNIQUE (user_id, product_id)` | **PASS** |
| Invariant 5 (No Lost Orders) | Durable disk orders | SQLite WAL persisted to disk | **PASS** |
| Invariant 6 (No Ghost Orders) | Errors don't save orders | Rollback on error in transaction | **PASS** |
| Invariant 7 (Sell-Through) | Drops hit 0 stock | Purchases always use exact authoritative stock | **PASS** |
| 2-Second Read Cache | Stock $\le 2\text{s}$ stale | Cache TTL set to 1.9s buffer | **PASS** |
| Offline Boot | No internet at restart | All dependencies vendored, zero external calls | **PASS** |

---

## 7. Operational Commands Quick Reference

```bash
# Run server
npm start

# Run all test suites
npm test
npm run test:concurrency
npm run test:reconciliation
npm run benchmark

# Verify port listener
sudo ss -tlnp | grep 8080
```
