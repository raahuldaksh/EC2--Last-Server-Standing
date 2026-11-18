# Optimization & Performance Change Log
# Last Server Standing — High-Performance Flash Sale API

---

## Change Log Baseline

### [Initial Implementation - Baseline] - 18 November 2026
- **Architecture:** Node.js v24, Fastify HTTP framework, SQLite 3 in WAL mode via `better-sqlite3`.
- **Concurrency & Invariants:**
  - `CHECK(stock >= 0)` and `CHECK(price >= 0)` constraints in `src/db/schema.sql`.
  - `UNIQUE(user_id, product_id)` constraint in `orders` table.
  - Single atomic conditional decrement in `orderService.js`.
- **Cache:** L1 in-memory map with 1.9s TTL buffer under the official 2-second rule.
- **Initial Benchmark (Single Process, Local):**
  - Requests: 81,350 in 10s
  - Throughput: 8,135.8 req/s
  - p50 Latency: 4 ms
  - p99 Latency: 13 ms
  - Errors: 0 (0.0%)

---

## Planned Optimizations (Pending Approval)

- **OPT-01 (P0):** Fix Benchmark Script (`tests/load/manual-ramp.js`)
  - Auto-seed target product before test.
  - Correct latency percentile reporting (`p97_5`).
  - Add explicit local execution guidance (avoid SSH tunnel for load testing).
- **OPT-02 (P1):** Multi-Process Clustering (`src/server.js`)
  - Implement Node.js native `cluster` with 2 workers matching the 2 vCPUs of `m7i.large`.
- **OPT-03 (P2):** Non-Blocking Sold-Out Read Optimization (`src/services/orderService.js`)
  - Fast read-check for sold-out products to avoid acquiring SQLite write locks when stock is 0.
- **OPT-04 (P3):** Pre-Serialized L1 Product Cache (`src/cache/productCache.js`)
  - Pre-encode static JSON strings for popular read products.
- **OPT-05 (P4):** Kernel Sockets Tuning (`deploy/sysctl.conf`)
  - Apply `somaxconn = 65535` and `tcp_tw_reuse = 1`.
