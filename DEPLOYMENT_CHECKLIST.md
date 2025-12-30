# 🚀 EventFlow PRO - Deployment Checklist

**Version:** 2.0 - Ultra Optimized
**Date:** 28 Aralık 2025

---

## 📋 Pre-Deployment Checklist

### 1. Database Migration ✅

```bash
# Backend dizinine git
cd backend

# Migration'ı çalıştır
npm run typeorm migration:run

# Verify indexes
npm run typeorm migration:show
```

**Verify SQL:**

```sql
-- Check all indexes created
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'IDX_%'
ORDER BY tablename, indexname;

-- Should return 30+ indexes
```

### 2. Environment Variables

**Backend (.env):**

```env
NODE_ENV=production
DB_HOST=your-db-host
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your-secure-password
DB_NAME=eventflow
DB_POOL_MAX=50
DB_POOL_MIN=10
SLOW_QUERY_THRESHOLD=500
JWT_SECRET=your-super-secret-jwt-key
CORS_ORIGINS=https://yourdomain.com
```

**Frontend (.env.production):**

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
```

### 3. Dependencies Check

```bash
# Backend
cd backend
npm ci --production
npm run build

# Frontend
cd frontend
npm ci
npm run build
```

### 4. Database Health Check

```sql
-- Check connection pool
SELECT count(*) as active_connections
FROM pg_stat_activity
WHERE datname = 'eventflow';

-- Check cache hit rate (should be > 90%)
SELECT
  sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as cache_hit_ratio
FROM pg_statio_user_tables;

-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC
LIMIT 10;
```

---

## 🔧 Deployment Steps

### Option 1: Docker Compose (Recommended)

```bash
# 1. Pull latest code
git pull origin main

# 2. Build images
docker-compose -f docker-compose.coolify.yml build

# 3. Run migrations
docker-compose run backend npm run typeorm migration:run

# 4. Start services
docker-compose -f docker-compose.coolify.yml up -d

# 5. Check logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Option 2: Coolify Deployment

1. **Push to GitHub:**

```bash
git add .
git commit -m "feat: ultra performance optimization"
git push origin main
```

2. **Coolify Dashboard:**

- Go to your EventFlow project
- Click "Deploy"
- Wait for build to complete
- Run migration manually:
  ```bash
  # SSH into backend container
  docker exec -it eventflow-backend sh
  npm run typeorm migration:run
  exit
  ```

3. **Verify Deployment:**

- Check health endpoint: `https://api.yourdomain.com/api/health`
- Check Swagger docs: `https://api.yourdomain.com/api/docs`
- Test frontend: `https://yourdomain.com`

---

## ✅ Post-Deployment Verification

### 1. Health Checks

```bash
# Backend health
curl https://api.yourdomain.com/api/health

# Expected response:
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "memory_heap": { "status": "up" },
    "memory_rss": { "status": "up" }
  }
}
```

### 2. Performance Tests

```bash
# Test events endpoint (should be < 200ms)
curl -w "@curl-format.txt" -o /dev/null -s \
  "https://api.yourdomain.com/api/events?page=1&limit=50" \
  -H "Authorization: Bearer YOUR_TOKEN"

# curl-format.txt:
time_namelookup:  %{time_namelookup}\n
time_connect:  %{time_connect}\n
time_starttransfer:  %{time_starttransfer}\n
time_total:  %{time_total}\n
```

### 3. Database Monitoring

```sql
-- Check slow queries (should be < 100ms)
SELECT
  query,
  mean_exec_time,
  calls,
  total_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check index usage (should be > 95%)
SELECT
  sum(idx_scan) as index_scans,
  sum(seq_scan) as sequential_scans,
  sum(idx_scan) / (sum(idx_scan) + sum(seq_scan)) * 100 as index_usage_pct
FROM pg_stat_user_tables;
```

### 4. Frontend Verification

**Open DevTools → Network:**

- Check bundle sizes (should be < 200KB gzipped)
- Check API response times (should be < 200ms)
- Check for 404 errors

**Open DevTools → Performance:**

- Run Lighthouse audit
- LCP should be < 2.5s ✅
- FID should be < 100ms ✅
- CLS should be < 0.1 ✅

---

## 📊 Monitoring Setup

### 1. Enable pg_stat_statements

```sql
-- Add to postgresql.conf
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
pg_stat_statements.max = 10000

-- Restart PostgreSQL
-- Then create extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

### 2. Backend Logging

**Check logs for slow queries:**

```bash
docker logs eventflow-backend | grep "Slow request"
```

**Expected output:**

```
🐢 Slow request: GET /api/events - 120ms
```

### 3. Set Up Alerts

**Database:**

- Alert if cache hit rate < 85%
- Alert if connection pool > 80%
- Alert if slow queries > 500ms

**Backend:**

- Alert if response time P95 > 200ms
- Alert if memory usage > 512MB
- Alert if error rate > 1%

**Frontend:**

- Alert if LCP > 3s
- Alert if bundle size > 250KB
- Alert if error rate > 0.5%

---

## 🔄 Rollback Plan

### If Issues Occur:

**1. Rollback Code:**

```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Or rollback to specific version
git reset --hard <previous-commit-hash>
git push -f origin main
```

**2. Rollback Database Migration:**

```bash
# SSH into backend container
docker exec -it eventflow-backend sh

# Revert migration
npm run typeorm migration:revert

# Verify
npm run typeorm migration:show
```

**3. Restart Services:**

```bash
docker-compose restart backend
docker-compose restart frontend
```

---

## 📈 Performance Monitoring (First Week)

### Daily Checks

**Day 1-3:**

- Monitor slow query log every 4 hours
- Check error logs every 2 hours
- Verify cache hit rate > 85%
- Check memory usage trends

**Day 4-7:**

- Monitor slow query log daily
- Check error logs daily
- Verify performance metrics stable
- Review user feedback

### Metrics to Track

| Metric           | Target  | Alert If |
| ---------------- | ------- | -------- |
| API Response P95 | < 100ms | > 200ms  |
| Database CPU     | < 30%   | > 60%    |
| Cache Hit Rate   | > 85%   | < 80%    |
| Error Rate       | < 0.5%  | > 1%     |
| Memory Usage     | < 512MB | > 700MB  |

---

## 🎯 Success Criteria

### Week 1 Goals

- ✅ Zero critical errors
- ✅ API response time < 100ms (P95)
- ✅ Database CPU < 30%
- ✅ Cache hit rate > 85%
- ✅ User complaints < 5

### Week 2 Goals

- ✅ All metrics stable
- ✅ No performance degradation
- ✅ User satisfaction improved
- ✅ Load testing passed (100 concurrent users)

---

## 📞 Support Contacts

**Database Issues:**

- Check: `DATABASE_OPTIMIZATION_REPORT.md`
- Run: `VACUUM ANALYZE` on affected tables

**Backend Issues:**

- Check: `CODE_OPTIMIZATION_GUIDE.md`
- Review: Backend logs for errors

**Frontend Issues:**

- Check: Browser console for errors
- Review: Network tab for failed requests

---

## 🎉 Deployment Complete!

**Next Steps:**

1. Monitor metrics for 24 hours
2. Review slow query log
3. Check user feedback
4. Fine-tune cache TTLs if needed
5. Celebrate the performance gains! 🚀

---

**Prepared by:** Kiro AI Assistant
**Date:** 28 Aralık 2025
**Version:** 2.0 - Ultra Optimized
