# LootChat Self-Deployment Guide

This guide will help you deploy LootChat on your own server with HTTPS/SSL support using Docker Compose and nginx as a reverse proxy.

## Prerequisites

- A server with Docker and Docker Compose installed
- A domain name pointing to your server's IP address
- Ports 80 and 443 open on your firewall

## Quick Start

### 1. Configure Your Domain

Before starting, ensure your domain's DNS A record points to your server's IP address:

```bash
A    @              your.server.ip.address
A    www            your.server.ip.address
```

DNS propagation can take up to 24-48 hours.

### 2. Set Up Environment Variables

Copy the example environment file and edit it with your configuration:

```bash
cp .env.selfdeploy.example .env
vim .env  
```

**Required variables to configure:**

- `DOMAIN`: Your domain name (e.g., `lootchat.example.com`)
- `POSTGRES_PASSWORD`: Strong database password
- `JWT_SECRET`: Random string (minimum 32 characters)
- `ADMIN_PASSWORD`: Strong admin account password
- `ADMIN_EMAIL`: Your email address (for SSL certificates)
- `NUXT_SESSION_PASSWORD`: Random string (minimum 32 characters)

**Optional variables:**

- Email settings if you want email notifications
- Tenor API key for GIF support

### 3. Run the Deployment Script

The deployment script will automatically:

- Create necessary directories
- Request SSL certificates from Let's Encrypt
- Start all services with HTTPS enabled

```bash
chmod +x deploy.sh
./deploy.sh
```

### 4. Access Your Application

After deployment completes, your LootChat instance will be available at:

- `https://yourdomain.com`

The admin account will be created automatically with the credentials from your `.env` file.

## Manual Deployment

If you prefer to deploy manually or the script doesn't work for your setup:

### 1. Create Directories

```bash
mkdir -p certbot/www certbot/conf nginx/conf.d
```

### 2. Update nginx Configuration

Replace `${DOMAIN}` in `nginx/conf.d/lootchat.conf` with your actual domain:

```bash
sed -i "s/\${DOMAIN}/yourdomain.com/g" nginx/conf.d/lootchat.conf
```

### 3. Obtain SSL Certificate

Start nginx temporarily:

```bash
docker compose -f compose-selfdeploy.yaml up -d nginx
```

Request certificate:

```bash
docker compose -f compose-selfdeploy.yaml run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email your@email.com \
    --agree-tos \
    --no-eff-email \
    -d yourdomain.com \
    -d www.yourdomain.com
```

### 4. Start All Services

```bash
docker compose -f compose-selfdeploy.yaml up -d
```

## Architecture

The deployment consists of the following services:

- **nginx**: Reverse proxy with SSL termination (ports 80, 443)
- **frontend**: Nuxt.js application (internal)
- **backend**: Spring Boot API (internal)
- **db**: PostgreSQL database (internal)
- **redis**: Redis cache (internal)
- **kafka**: Message broker (internal)
- **certbot**: Automatic SSL certificate renewal (internal)

All services except nginx run on an internal network and are not directly accessible from the internet.

## SSL Certificate Management

### Automatic Renewal

SSL certificates are automatically renewed by certbot every 12 hours. No manual intervention is required.

### Manual Renewal

To manually renew certificates:

```bash
docker compose -f compose-selfdeploy.yaml run --rm certbot renew
docker compose -f compose-selfdeploy.yaml restart nginx
```

### Certificate Expiration

Let's Encrypt certificates are valid for 90 days. The certbot service will automatically renew them when they have 30 days or less remaining.

## Useful Commands

### View Logs

```bash
# All services
docker compose -f compose-selfdeploy.yaml logs -f

# Specific service
docker compose -f compose-selfdeploy.yaml logs -f backend
docker compose -f compose-selfdeploy.yaml logs -f nginx
```

### Restart Services

```bash
# All services
docker compose -f compose-selfdeploy.yaml restart

# Specific service
docker compose -f compose-selfdeploy.yaml restart backend
```

### Stop Services

```bash
docker compose -f compose-selfdeploy.yaml down
```

### Update Application

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker compose -f compose-selfdeploy.yaml up -d --build
```

## Security Considerations

1. **Firewall**: Only ports 80 and 443 should be open to the internet
2. **Strong Passwords**: Use strong, unique passwords for all services
3. **JWT Secret**: Use a cryptographically secure random string (32+ characters)
4. **Session Password**: Use a cryptographically secure random string (32+ characters)
5. **Database**: The database is only accessible within the Docker network
6. **SSL/TLS**: Modern TLS configuration with strong ciphers
7. **Rate Limiting**: nginx is configured with rate limiting for API and WebSocket endpoints

## Performance Tuning

### nginx Worker Processes

Edit `nginx/nginx.conf` to adjust worker processes based on your CPU cores:

```nginx
worker_processes auto;  # or specify number like '4'
```

### Database Connection Pool

Edit backend environment in `compose-selfdeploy.yaml`:

```yaml
- SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE=20
```

### Upload Size Limit

Edit `nginx/nginx.conf` to change max upload size:

```nginx
client_max_body_size 100M;  # Adjust as needed
```

## Monitoring

### Health Checks

All services have health checks configured. Check status:

```bash
docker compose -f compose-selfdeploy.yaml ps
```

### Resource Usage

```bash
docker stats
```

## Troubleshooting

### SSL Certificate Issues

If certificate generation fails:

1. Verify DNS points to your server: `dig yourdomain.com`
2. Check ports 80/443 are open: `netstat -tlnp | grep -E ':(80|443)'`
3. Check nginx logs: `docker compose -f compose-selfdeploy.yaml logs nginx`
4. Check certbot logs: `docker compose -f compose-selfdeploy.yaml logs certbot`

### Backend Connection Issues

If frontend can't connect to backend:

1. Check backend logs: `docker compose -f compose-selfdeploy.yaml logs backend`
2. Verify database is healthy: `docker compose -f compose-selfdeploy.yaml ps db`
3. Check redis connection: `docker compose -f compose-selfdeploy.yaml logs redis`

### Database Connection Issues

1. Verify credentials in `.env` file
2. Check database logs: `docker compose -f compose-selfdeploy.yaml logs db`
3. Test connection: `docker compose -f compose-selfdeploy.yaml exec db psql -U $POSTGRES_USER -d $POSTGRES_DB`

## Backup and Recovery

### Database Backup

```bash
docker compose -f compose-selfdeploy.yaml exec db pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup.sql
```

### Database Restore

```bash
docker compose -f compose-selfdeploy.yaml exec -T db psql -U $POSTGRES_USER $POSTGRES_DB < backup.sql
```

### Full Backup

```bash
docker run --rm \
    -v lootchat-postgres-data:/data \
    -v $(pwd):/backup \
    alpine tar czf /backup/postgres-backup.tar.gz -C /data .

docker run --rm \
    -v lootchat-backend-uploads:/data \
    -v $(pwd):/backup \
    alpine tar czf /backup/uploads-backup.tar.gz -C /data .
```

## Support

For issues and questions:

- Check the logs first
- Review this documentation
- Open an issue on GitHub

## License

See LICENSE file in the repository.
