# Phase 1: Comprehensive System & Performance Audit
# Last Server Standing — EC2 Optimization & 50K+ RPS Target
**Date:** 18 November 2026  
**Target Environment:** AWS EC2 `m7i.large` (2 vCPU, 8 GiB RAM, 30 GiB gp3 SSD, Ubuntu 24.04 LTS)  
**Author:** Senior Backend Performance Engineer & Systems Architect  

---

## 1. Executive Root-Cause Analysis: The Previous Benchmark Anomalies

In previous test runs, the benchmark reported severe anomalies:
- **10 RPS:** Actual 10 RPS, p50: 251 ms, p99: 907 ms
- **100 RPS:** Actual 90 RPS, p50: 272 ms, p99: 891 ms
- **5,000 RPS Target:** Actual only 283.4 RPS, p50: 442 ms, p99: 2,689 ms, 100% non-2xx, 69,961 socket errors, 129 timeouts
- **Warning:** `TimeoutNegativeWarning: -40 is a negative number. Timeout duration was set to 1.`
- **Metrics Bug:** `p95` reported as `undefined` / `n/a`

### Root Cause 1: Benchmark Was Executed Across an SSH Tunnel from a Remote Laptop
- **Evidence:** At 10 RPS (practically zero server load), p50 latency was **251 ms**. On local loopback (`http://127.0.0.1:8080`), latency is $< 2\text{ ms}$. 
- **Cause:** The benchmark script (`tests/load/manual-ramp.js`) was run on the user's Windows development machine, forwarding requests over an SSH tunnel (`ssh -L 8080:localhost:8080`) across the public internet to the EC2 instance in AWS.
- **Impact:**
  1. Base round-trip internet ping (e.g. India $\to$ AWS region) adds 150–250 ms of network overhead to every request.
  2. An SSH tunnel multiplexes all TCP traffic into a **single encrypted TCP stream**. Sending 500 concurrent connections at 5,000 RPS through an SSH tunnel instantly caused **SSH connection buffer saturation**, packet drops, and **69,961 socket errors**.
  3. **Official Rulebook Clause:** Section 02 & Section 16 state:
     > *"Port 8080 is never open to the internet, not even to your laptop... The load generator is in the same AWS availability zone as your machine, so the network is the same for everyone... Use the Windows laptop SSH tunnel for development health checks, NOT as proof of official benchmark capacity."*

### Root Cause 2: 100% Non-2xx Responses in Test C (The Missing Test Product)
- **Evidence:** In `tests/load/manual-ramp.js` line 6:
  ```javascript
  const productId = process.env.PRODUCT_ID || (mode === 'write' ? 'p_load_write_test' : 'p_load_100');
  ```
- **Cause:** When `manual-ramp.js` was run in read mode without seeding `p_load_100`, every request called `GET /products/p_load_100`.
- **Result:** The server correctly returned `404 { "error": "PRODUCT_NOT_FOUND" }`. Because Autocannon counts any non-2xx status code as `non2xx`, **100% of the responses were counted as failures!** The server was responding with valid 404s, but the benchmark was querying a non-existent product.

### Root Cause 3: `TimeoutNegativeWarning: -40` in Autocannon
- **Evidence:** Node.js warning: `TimeoutNegativeWarning: -40 is a negative number. Timeout duration was set to 1.`
- **Cause:** Autocannon's internal rate-pacer calculates `delay = targetTickTime - Date.now()`. When requests back up due to SSH socket stalls, `Date.now()` exceeds `targetTickTime`, resulting in a negative delay (e.g. `-40 ms`). Node's `setTimeout()` throws this warning when passed a negative number.

### Root Cause 4: Undefined `p95` Metric
- **Evidence:** Log output showed `p95 undefined ms`.
- **Cause:** Autocannon's latency object exports percentiles: `p2_5`, `p50`, `p97_5`, `p99`, `p99_9`. It does **not** expose a `.p95` property. Querying `result.latency.p95` evaluates directly to `undefined`.

---

## 2. Current Architecture & Codebase Audit

### 2.1 Process & Concurrency Model
- **Current State:** `src/server.js` runs as a single Node.js process.
- **Hardware Bottleneck:** The EC2 `m7i.large` instance provides 2 vCPUs (1 physical Intel Xeon core, 2 hyperthreads). A single Node.js event loop runs on 1 thread, utilizing only 1 vCPU (max 50% system compute capacity). The second vCPU remains idle.
- **Optimization:** Implement **Node.js Native Cluster with 2 worker processes** pinned to the 2 vCPUs. This doubles HTTP throughput and saturates available compute.

### 2.2 Database Engine & Lock Contention
- **Current State:** SQLite 3 in WAL mode via `better-sqlite3`.
- **Strengths:** Zero IPC / network overhead (in-process C++ binding), fast memory-mapped I/O.
- **Bottleneck Identified in Order Purchases:**
  In `src/services/orderService.js`:
  ```sql
  UPDATE products SET stock = stock - 1 WHERE id = ? AND stock > 0 ... RETURNING stock;
  ```
  - In SQLite, an `UPDATE` statement acquires a **database-level write lock**, even if 0 rows match.
  - In a flash drop, 50–200 units sell out within the first 1–2 seconds. For the remaining 28 seconds, thousands of incoming order requests execute `UPDATE` statements on a sold-out product, contending for the write lock!
  - **Optimization:** Check authoritative stock via a non-blocking `SELECT stock FROM products WHERE id = ?` first. In SQLite WAL mode, shared read locks execute in parallel across multiple workers without blocking. If `stock <= 0`, return `409 SOLD_OUT` immediately as a read operation without acquiring a write lock!

### 2.3 In-Memory Cache Optimization (The 2-Second Rule)
- **Current State:** `src/cache/productCache.js` caches product objects, but Fastify re-serializes the JSON object on every `GET /products/:id` request (60% of all benchmark traffic).
- **Optimization:** Cache the **pre-serialized JSON Buffer/String** for the immutable attributes (`id`, `name`, `category`, `price`) with volatile `stock`. This eliminates JSON serialization overhead in V8 for 60% of all requests.

### 2.4 Linux Kernel & Socket Layer
- **Current State:** OS defaults on Ubuntu 24.04 limit file descriptors to 1024 and connection backlogs to 128/4096.
- **Optimization:** Apply `/etc/sysctl.conf` and `/etc/security/limits.conf` (`somaxconn = 65535`, `tcp_max_syn_backlog = 65535`, `tcp_tw_reuse = 1`, `nofile = 65535`).

---

## 3. Prioritized Optimization & Action Plan

| Priority | Component | Optimization Task | Expected Impact |
|---|---|---|---|
| **P0** | **Benchmark Harness** | Fix `tests/load/manual-ramp.js` (fix product seeding, fix `p97_5` latency, fix pacing, add local execution mode) | Accurate, noise-free local measurements |
| **P1** | **Multi-Core Clustering** | Update `src/server.js` with Node.js `cluster` (2 workers matching 2 vCPUs) | **2x throughput increase** (saturates both vCPUs) |
| **P2** | **Zero-Lock Sold-Out Reads** | Optimize `orderService.js` to avoid write locks on sold-out products | Eliminates SQLite write lock contention under flash load |
| **P3** | **Pre-Serialized L1 Cache** | Pre-serialize JSON responses for `GET /products/:id` | Bypasses V8 serialization overhead for 60% of traffic |
| **P4** | **Linux System Tuning** | Deploy `deploy/sysctl.conf` and `deploy/limits.conf` on EC2 host | Supports 5,000+ simultaneous keep-alive sockets |
| **P5** | **Progressive Load Testing** | Run stepped tests (500 $\to$ 1,000 $\to$ 2,000 $\to$ 5,000 $\to$ 10,000+ RPS) locally on EC2 | Measure true hardware ceiling and record reports |

---

## 4. Expected Benefits & Risk Assessment

- **Expected Benefits:**
  - True local loopback latency will drop from 250+ ms down to **2–8 ms**.
  - Throughput will scale from 8,000 RPS up toward the hardware limits of the 2-vCPU instance.
  - Zero socket errors and zero negative timeout warnings.
  - 100% preservation of all 7 sale invariants and official API contracts.
- **Risks & Mitigations:**
  - *Risk:* Multi-process SQLite write lock contention.  
    *Mitigation:* Keep `busy_timeout = 5000`, serialize writes through atomic `BEGIN IMMEDIATE` transactions, and use read-first checks for sold-out products.
  - *Risk:* Cache staleness exceeding 2 seconds.  
    *Mitigation:* Retain 1.9s TTL buffer to strictly guarantee compliance with Section 05.

---

## 5. Required Verification Gates Before Implementation

Before accepting each optimization:
1. `npm test`: All 27 functional tests must pass 100%.
2. `npm run test:concurrency`: Test A (last unit) and Test B (double click) must pass with zero overselling.
3. `npm run test:reconciliation`: Zero negative stock, zero orphaned orders.
4. Progressive load testing on local EC2 machine (never over SSH tunnel).
