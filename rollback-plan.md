# Rollback Plan & Safety Procedures
# Last Server Standing — High-Performance Flash Sale API

---

## 1. Rollback Strategy Overview
Any optimization that breaks official competition rules, compromises database consistency, causes test regressions, or degrades p99 latency must be immediately rolled back.

Git tags and commit checkpoints are used to guarantee safe rollbacks.

- **Baseline Working Commit:** `cf28899` ("Complete Last Server Standing Production API Server").
- **Rollback Command:**
  ```bash
  git reset --hard cf28899
  ```

---

## 2. Component-Specific Rollback Procedures

### OPT-01: Benchmark Script (`tests/load/manual-ramp.js`)
- **Failure Trigger:** Test script errors, improper statistics collection.
- **Rollback:** `git checkout HEAD -- tests/load/manual-ramp.js`

### OPT-02: Multi-Process Clustering (`src/server.js`)
- **Failure Trigger:** SQLite file lock busy errors between workers, port binding conflicts.
- **Rollback:** Revert `src/server.js` to single-process mode (`git checkout HEAD -- src/server.js`).

### OPT-03: Zero-Lock Sold-Out Optimization (`src/services/orderService.js`)
- **Failure Trigger:** Invariant violation in Test A or Test B, stale stock rejection.
- **Rollback:** `git checkout HEAD -- src/services/orderService.js`

### OPT-04: Kernel Sysctl Tuning (`deploy/sysctl.conf`)
- **Failure Trigger:** Kernel networking instability or socket exhaustion.
- **Rollback Command on EC2:**
  ```bash
  sudo rm -f /etc/sysctl.d/99-last-server.conf
  sudo rm -f /etc/security/limits.d/99-last-server.conf
  sudo sysctl --system
  ```

---

## 3. Database Recovery Procedure
If database tables become corrupted during stress testing:
```bash
# Backup existing database
cp data/shop.db data/shop.db.bak

# Reset cleanly
rm -f data/shop.db data/shop.db-wal data/shop.db-shm

# Re-run functional tests to recreate fresh tables
npm test
```
