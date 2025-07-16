# 🚀 Heimdall Production Deployment Guide

This guide provides instructions for deploying Heimdall in a production environment using Docker.

## 📋 Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 2GB RAM available
- 10GB free disk space

## ⚙️ Production Setup

### 1. Environment Configuration

Create a production `.env` file based on `.env.example`:

```bash
cp .env.example .env.prod
```

**Important**: Update the following values for production:

```env
# Database
POSTGRES_PASSWORD=your_very_secure_database_password_here
POSTGRES_DB=heimdall_prod

# JWT Security
JWT_SECRET=your-super-secure-jwt-secret-key-at-least-64-characters-long-for-production
JWT_EXPIRES_IN=7d

# Server
NODE_ENV=production
HOST=0.0.0.0
PORT=3000

# CORS - Add your production domains
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key-for-production-aes-256

# Logging
LOG_LEVEL=warn
LOG_MAX_SIZE=50m
LOG_MAX_FILES=14d
```

### 2. Build and Deploy

```bash
# Build the production images
docker-compose -f docker-compose.prod.yml build

# Deploy the stack
docker-compose -f docker-compose.prod.yml up -d
```

### 3. Database Migration

The migration service will automatically run database migrations on startup. You can also run them manually:

```bash
# Run migrations manually
docker-compose -f docker-compose.prod.yml run --rm migrate
```

### 4. Verify Deployment

```bash
# Check all services are running
docker-compose -f docker-compose.prod.yml ps

# Check API health
curl http://localhost:3000/health

# View logs
docker-compose -f docker-compose.prod.yml logs api
```

## 🔒 Security Considerations

### Environment Variables
- **Never** use default passwords in production
- Use strong, randomly generated secrets
- Store sensitive data in secure environment variable management systems

### CORS Configuration
- Specify exact origins in `CORS_ORIGINS`
- Never use `*` for CORS origins in production

### Database Security
- Use strong database passwords
- Consider using database connection pooling
- Regular database backups are recommended

### Container Security
- The application runs as a non-root user (`heimdall`)
- Uses minimal Alpine Linux base images
- Includes health checks for monitoring

## 📊 Monitoring & Maintenance

### Health Checks
The API includes built-in health checks accessible at `/health`:

```bash
curl http://localhost:3000/health
```

### Logs
Logs are stored in Docker volumes and rotated automatically:

```bash
# View API logs
docker logs heimdall_api_prod

# Follow logs in real-time
docker logs -f heimdall_api_prod
```

### Database Backup

```bash
# Create database backup
docker exec heimdall_postgres_prod pg_dump -U postgres heimdall_prod > backup.sql

# Restore from backup
docker exec -i heimdall_postgres_prod psql -U postgres heimdall_prod < backup.sql
```

## 🔄 Updates & Maintenance

### Updating the Application

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.prod.yml build api
docker-compose -f docker-compose.prod.yml up -d api
```

### Database Migrations

```bash
# Run new migrations
docker-compose -f docker-compose.prod.yml run --rm migrate
```

## 🛠️ Troubleshooting

### Common Issues

**1. Database Connection Issues**
```bash
# Check database is running
docker-compose -f docker-compose.prod.yml ps postgres

# Check database logs
docker-compose -f docker-compose.prod.yml logs postgres
```

**2. API Not Starting**
```bash
# Check API logs
docker-compose -f docker-compose.prod.yml logs api

# Restart API service
docker-compose -f docker-compose.prod.yml restart api
```

**3. Migration Failures**
```bash
# Check migration logs
docker-compose -f docker-compose.prod.yml logs migrate

# Reset database (⚠️ DATA LOSS)
docker-compose -f docker-compose.prod.yml down -v
docker-compose -f docker-compose.prod.yml up -d
```

## 🚦 Service Management

```bash
# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Stop all services
docker-compose -f docker-compose.prod.yml down

# Restart specific service
docker-compose -f docker-compose.prod.yml restart api

# View service status
docker-compose -f docker-compose.prod.yml ps

# View resource usage
docker stats
```

## 📈 Performance Tuning

### Database Optimization
- Consider using PostgreSQL connection pooling (PgBouncer)
- Tune PostgreSQL configuration for your workload
- Regular VACUUM and ANALYZE operations

### Application Optimization
- Monitor memory usage and adjust container limits
- Use Redis for session storage in multi-instance deployments
- Consider implementing rate limiting

---

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review application logs
3. Verify environment configuration
4. Consult the main project documentation

**Remember**: Always test deployments in a staging environment before production!
