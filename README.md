# EC2--Last-Server-Standing
# Last Server Standing — Production Operations & Server Run Guide
# Sheryians Coding School — KODR (API Spec v1.1)

---

## 📌 1. Project Overview & Environment Baseline

This repository contains the complete production-grade Flash Sale Shop API engineered to compete in **Last Server Standing**.

- **Target Machine:** AWS EC2 `m7i.large` (2 vCPU, 8 GiB RAM, 30 GiB gp3 SSD, Ubuntu 24.04 LTS).
- **Listening Address:** `0.0.0.0:8080` (Plain HTTP/1.1 with keep-alive).
- **Core Stack:** Node.js (ES Modules), Fastify, SQLite 3 (WAL Mode via `better-sqlite3`), Linux `systemd`.

---

## 🚀 2. Initial Setup & Installation on EC2

### Step 2.1: Inspect the EC2 Environment
Run on the EC2 instance terminal to verify your hardware and kernel parameters:
```bash
# Check CPU cores (should show 2 vCPUs)
lscpu | grep -E "Model name|CPU\(s\):|Thread\(s\) per core:"

# Check Memory (should show 8 GiB)
free -h

# Check Storage (should show 30 GiB gp3)
lsblk
df -h /
```

### Step 2.2: Clone or Copy Project onto EC2
```bash
cd /home/ubuntu
git clone <your-repo-url> last-server-standing
# OR copy directory to /home/ubuntu/last-server-standing
cd /home/ubuntu/last-server-standing
```

### Step 2.3: Install Dependencies (Before Code Freeze)
> [!IMPORTANT]
> Outbound internet is cut at code freeze. All dependencies MUST be installed in advance.
```bash
# Install Node.js v20 or v24 LTS if not present
sudo apt update && sudo apt install -y nodejs npm

# Install production dependencies
npm install --omit=dev
```

### Step 2.4: Apply Linux OS Performance Tuning
Apply kernel network parameters to support 5,000+ keep-alive connections:
```bash
sudo cp deploy/sysctl.conf /etc/sysctl.d/99-last-server.conf
sudo sysctl --system

sudo cp deploy/limits.conf /etc/security/limits.d/99-last-server.conf
```

---

## ⚙️ 3. Process Execution & Management (systemd)

We use Linux `systemd` to ensure the server automatically restarts within $< 1\text{ s}$ after an unexpected crash.

### Step 3.1: Install & Enable the Systemd Service
```bash
sudo cp deploy/last-server-standing.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable last-server-standing
sudo systemctl start last-server-standing
```

### Step 3.2: Manage Service Lifecycle
```bash
# Check status
sudo systemctl status last-server-standing

# Restart server
sudo systemctl restart last-server-standing

# Stop server
sudo systemctl stop last-server-standing

# Verify port 8080 is listening on 0.0.0.0
sudo ss -tlnp | grep 8080
```

---

## 📜 4. Viewing Logs & Diagnostics

Because per-request logging is disabled for high-throughput performance, logs contain only critical lifecycle events and uncaught errors:

```bash
# Live stream logs
sudo journalctl -u last-server-standing -f

# View last 100 log lines
sudo journalctl -u last-server-standing -n 100 --no-pager

# Check for startup errors or crashes
sudo journalctl -u last-server-standing -p err
```

---

## 📊 5. Live Server Monitoring

Run these commands during testing to observe resource utilization on the 2-vCPU machine:

```bash
# 1. CPU & Memory utilization
htop
# OR
top -b -n 1 | head -n 15

# 2. Disk I/O activity (gp3 SSD)
iostat -xz 1 5

# 3. Open TCP connections on port 8080
ss -s
ss -t state established '( sport = :8080 )' | wc -l

# 4. Check database file size and WAL size
ls -lh data/
```

---

## 📡 6. Complete API Testing with `curl`

To test from your laptop without exposing port 8080 to the public internet, open an SSH tunnel in a separate terminal:
```bash
ssh -i student-25.pem -N -L 8080:localhost:8080 ubuntu@<public-ip>
```

### Endpoint 1: Ready Check
```bash
curl -i http://localhost:8080/health
# Response: 200 OK {"status":"ok"}
```

### Endpoint 2: Create Product
```bash
# Valid product creation
curl -i -X POST http://localhost:8080/products \
  -H "Content-Type: application/json" \
  -d '{"id":"p3f9a0c2e71bd","name":"Pixel 10 Pro 256GB","category":"c8d21fa","price":79999,"stock":120}'
# Response: 201 Created

# Duplicate product ID test
curl -i -X POST http://localhost:8080/products \
  -H "Content-Type: application/json" \
  -d '{"id":"p3f9a0c2e71bd","name":"Pixel Duplicate","category":"c8d21fa","price":89999,"stock":10}'
# Response: 409 Conflict {"error":"PRODUCT_EXISTS"}
```

### Endpoint 3: Read Single Product
```bash
# Existing product
curl -i http://localhost:8080/products/p3f9a0c2e71bd
# Response: 200 OK {"id":"p3f9a0c2e71bd","name":"Pixel 10 Pro 256GB","category":"c8d21fa","price":79999,"stock":120}

# Non-existent product
curl -i http://localhost:8080/products/p000000000000
# Response: 404 Not Found {"error":"PRODUCT_NOT_FOUND"}
```

### Endpoint 4: Category Listing (Sorted price ASC, id ASC)
```bash
# Category list (first page)
curl -i "http://localhost:8080/products?category=c8d21fa&page=1&limit=20"
# Response: 200 OK {"items":[...],"page":1,"limit":20,"total":1}
```

### Endpoint 5: Purchase Product (Atomic)
```bash
# Successful purchase
curl -i -X POST http://localhost:8080/orders \
  -H "Content-Type: application/json" \
  -d '{"userId":"u7b0e44c19a2f","productId":"p3f9a0c2e71bd"}'
# Response: 201 Created {"orderId":"o_...","userId":"u7b0e44c19a2f","productId":"p3f9a0c2e71bd"}

# Duplicate purchase (Same user and product)
curl -i -X POST http://localhost:8080/orders \
  -H "Content-Type: application/json" \
  -d '{"userId":"u7b0e44c19a2f","productId":"p3f9a0c2e71bd"}'
# Response: 409 Conflict {"error":"ALREADY_PURCHASED"}
```

### Endpoint 6: User Order History
```bash
curl -i http://localhost:8080/users/u7b0e44c19a2f/orders
# Response: 200 OK {"userId":"u7b0e44c19a2f","orders":[{"orderId":"o_...","productId":"p3f9a0c2e71bd"}]}
```

---

## 🧪 7. Automated Verification & Concurrency Tests

Run these test suites directly on the machine:

```bash
# 1. Run all ~40 functional tests (Must be 100%)
npm test

# 2. Run Test A (Last Unit) and Test B (Double-Click) Concurrency tests
npm run test:concurrency

# 3. Run Post-Run Accounting Reconciliation
npm run test:reconciliation

# 4. Run local multi-level benchmark simulation (Autocannon)
npm run benchmark
```

### Manual EC2 Read-Load Ramp

Use this read-only test to increase concurrent connections against the running EC2 API. It does not create products or orders. Run it from your computer through an SSH tunnel so port 8080 does not need to be opened publicly.

Terminal 1 (PowerShell):
```powershell
ssh -i "<path-to-key.pem>" -N -L 8080:127.0.0.1:8080 ubuntu@<EC2_PUBLIC_IP>
```

Terminal 2, from the project folder:
```powershell
npm run benchmark:manual
```

The default ramp starts at 1,000 requests/second and increases through 1,500, 2,000, 2,500, 3,000, 4,000, and 5,000; each step lasts 15 seconds. The test reads `p_load_100`, checks `/health` once per second, and stops if it cannot reach 90% of the target rate, errors exceed 1%, p99 exceeds 1 second, or a health check fails. The script caps a single run at 10,000 requests/second. It reports actual response latency; only judge latency when the achieved rate is at least 90% of target. It separately reports the highest step meeting the PRD p99 target of 100 ms.

Requests/second is not the same as unique users/second: one user may send many requests. The report shows both the requested and achieved request rate.

If that product is absent, set `PRODUCT_ID` to an existing product ID. To adjust the run in PowerShell:
```powershell
$env:PRODUCT_ID = "p_load_100"
$env:RPS_STEPS = "1000,1500,2000,2500"
$env:STEP_DURATION = "15"
npm run benchmark:manual
```

Watch EC2 resources in another terminal with `ssh -i "<path-to-key.pem>" ubuntu@<EC2_PUBLIC_IP> "top -b -n 1 | head -15"` and inspect service logs with `ssh -i "<path-to-key.pem>" ubuntu@<EC2_PUBLIC_IP> "sudo journalctl -u last-server-standing -f"`. Let the server cool down between runs. This measures the API through the SSH tunnel and your client/network too; it is not an exact maximum-user guarantee.

> Do not run `npm run benchmark` against the live EC2 database: that existing benchmark clears product/order tables and starts a separate server on port 8080.

---

## 💥 8. Crash Recovery Verification (Official Test 3)

Verify that the server recovers unattended and preserves all committed orders:
```bash
# 1. Find process listening on 8080
sudo ss -tlnp | grep 8080

# 2. Kill the process forcefully (SIGKILL)
sudo kill -9 <pid>

# 3. Wait 2 seconds, then verify automatic recovery:
curl -s http://localhost:8080/health
# Should return {"status":"ok"}

# 4. Verify data integrity
npm run test:reconciliation
```

---

## 📋 9. Pre-Flight Code Freeze Checklist

Before test day code freeze, ensure:
- [x] Server binds to `0.0.0.0:8080` (never `127.0.0.1`).
- [x] All 6 endpoints match v1.1 schemas and status codes.
- [x] Database resides locally on disk (`data/shop.db` in WAL mode).
- [x] Concurrency Test A (50 buyers, 1 unit) produces exactly one 201.
- [x] Concurrency Test B (20 duplicate clicks) produces exactly one 201.
- [x] Zero external network dependencies at runtime.
- [x] Systemd auto-restart is active and verified.
- [x] Zero per-request console logging.
