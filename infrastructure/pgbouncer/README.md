# PgBouncer Configuration

This directory contains the configuration files for PgBouncer, a lightweight connection pooler for PostgreSQL that helps optimize database connection management.

## Overview

PgBouncer is configured to run in **transaction mode**, which provides the best balance between connection efficiency and application compatibility. In transaction mode, server connections are released back to the pool after each transaction completes.

## Configuration Files

### `pgbouncer.ini`
Main configuration file containing:
- **Pool Settings**: Default pool size of 20, minimum of 5, reserve of 5
- **Connection Limits**: Maximum 100 client connections
- **Timeouts**: Optimized for the learning platform workload
- **Logging**: Enabled for monitoring and debugging
- **Security**: MD5 authentication with user list

### `userlist.txt`
Authentication file containing user credentials in MD5 format.
**Note**: In production, use proper password hashing and secure credential management.

## Docker Integration

PgBouncer is integrated into the Docker Compose setup:
- **Port**: 6432 (mapped to host)
- **Health Check**: Monitors PgBouncer status
- **Dependencies**: Waits for PostgreSQL to be ready

## Usage

### Development
```bash
# Start with PgBouncer
docker-compose up -d

# Connect through PgBouncer
psql postgresql://postgres:password@localhost:6432/learning_platform

# Connect directly to PostgreSQL (bypass PgBouncer)
psql postgresql://postgres:password@localhost:5432/learning_platform
```

### Application Configuration
```bash
# Enable PgBouncer in your application
USE_PGBOUNCER=true
PGBOUNCER_URL=postgresql://postgres:password@localhost:6432/learning_platform
```

## Monitoring

### PgBouncer Admin Interface
```sql
-- Connect to PgBouncer admin
psql postgresql://postgres:password@localhost:6432/pgbouncer

-- Show pool statistics
SHOW POOLS;

-- Show client connections
SHOW CLIENTS;

-- Show server connections
SHOW SERVERS;

-- Show configuration
SHOW CONFIG;

-- Show statistics
SHOW STATS;
```

### Key Metrics to Monitor
- **Pool utilization**: `cl_active / maxwait_us`
- **Queue length**: `maxwait_us`
- **Connection lifetime**: `avg_sent` and `avg_recv`
- **Error rates**: Check logs for connection errors

## Performance Tuning

### Pool Size Optimization
The optimal pool size depends on your workload:

```ini
# Conservative (low concurrency)
default_pool_size = 15
min_pool_size = 3
reserve_pool_size = 3

# Moderate (medium concurrency)
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5

# Aggressive (high concurrency)
default_pool_size = 30
min_pool_size = 8
reserve_pool_size = 8
```

### Connection Timeouts
Adjust based on your application's query patterns:

```ini
# Fast queries (< 1 second)
query_timeout = 30
query_wait_timeout = 60

# Mixed workload (default)
query_timeout = 0
query_wait_timeout = 120

# Long-running queries
query_timeout = 0
query_wait_timeout = 300
```

## Load Testing

Use the built-in load testing tools to optimize your configuration:

```bash
# Run optimization tests
npm run optimize:pools

# Test different load levels
npm run optimize:pools:light
npm run optimize:pools:heavy

# Run all test presets
npm run optimize:pools:all

# Quick stress test
npm run stress:test
```

## Production Considerations

### Security
1. **Use strong passwords** and rotate them regularly
2. **Enable SSL/TLS** for all connections
3. **Restrict network access** to PgBouncer
4. **Use connection limits** to prevent resource exhaustion

### High Availability
1. **Deploy multiple PgBouncer instances** behind a load balancer
2. **Monitor PgBouncer health** and restart failed instances
3. **Use read replicas** with separate PgBouncer pools
4. **Implement circuit breakers** for database failures

### Monitoring and Alerting
1. **Pool utilization > 80%**: Consider increasing pool size
2. **High queue wait times**: Investigate slow queries or increase pools
3. **Connection errors**: Check database health and network connectivity
4. **Memory usage**: Monitor PgBouncer memory consumption

## Troubleshooting

### Common Issues

#### High Connection Wait Times
```sql
-- Check pool status
SHOW POOLS;

-- Look for high maxwait_us values
-- Solution: Increase pool size or optimize queries
```

#### Connection Refused Errors
```bash
# Check PgBouncer logs
docker logs learning-platform-pgbouncer

# Verify PostgreSQL connectivity
docker exec -it learning-platform-pgbouncer psql -h postgres -U postgres -d learning_platform
```

#### Pool Exhaustion
```sql
-- Check active connections
SHOW CLIENTS;
SHOW SERVERS;

-- Look for stuck connections
-- Solution: Investigate long-running transactions
```

### Debug Mode
Enable detailed logging for troubleshooting:

```ini
log_connections = 1
log_disconnections = 1
log_pooler_errors = 1
verbose = 1
```

## References

- [PgBouncer Documentation](https://www.pgbouncer.org/usage.html)
- [PostgreSQL Connection Pooling Best Practices](https://www.postgresql.org/docs/current/runtime-config-connection.html)
- [Performance Tuning Guide](https://wiki.postgresql.org/wiki/Performance_Optimization)