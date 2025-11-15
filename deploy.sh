#!/bin/bash

# LootChat Self-Deploy Setup Script
# This script helps you set up SSL certificates and deploy LootChat to a server

set -e

echo "LootChat Self-Deploy Setup"
echo "=============================="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Error: .env file not found!"
    echo "Please create a .env file with the required environment variables."
    echo "See .env.example for reference."
    exit 1
fi

# Load environment variables
source .env

# Check required variables
if [ -z "$DOMAIN" ]; then
    echo "Error: DOMAIN environment variable is not set!"
    echo "Please add DOMAIN=yourdomain.com to your .env file"
    exit 1
fi

if [ -z "$ADMIN_EMAIL" ]; then
    echo "Error: ADMIN_EMAIL environment variable is not set!"
    echo "Please add ADMIN_EMAIL=your@email.com to your .env file"
    exit 1
fi

echo "Configuration:"
echo "   Domain: $DOMAIN"
echo "   Email: $ADMIN_EMAIL"
echo ""

echo "Creating directories..."
mkdir -p certbot/www certbot/conf nginx/conf.d

echo "Configuring nginx..."
sed "s/\${DOMAIN}/$DOMAIN/g" nginx/conf.d/lootchat.conf > nginx/conf.d/lootchat.conf.tmp
mv nginx/conf.d/lootchat.conf.tmp nginx/conf.d/lootchat.conf

if [ -d "certbot/conf/live/$DOMAIN" ]; then
    echo "SSL certificates already exist for $DOMAIN"
    echo ""
    echo "🐳 Starting services with existing certificates..."
    docker compose -f compose-selfdeploy.yaml up -d
else
    echo "🔐 Setting up SSL certificates..."
    echo ""
    echo "Step 1: Starting nginx with HTTP only for certificate generation..."
    
    cat > nginx/conf.d/initial.conf << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 "Waiting for SSL certificate...\n";
        add_header Content-Type text/plain;
    }
}
EOF
    
    sed "s/\${DOMAIN}/$DOMAIN/g" nginx/conf.d/initial.conf > nginx/conf.d/initial.conf.tmp
    mv nginx/conf.d/initial.conf.tmp nginx/conf.d/initial.conf
    rm nginx/conf.d/lootchat.conf
    
    docker compose -f compose-selfdeploy.yaml up -d nginx
    
    echo "Waiting for nginx to start..."
    sleep 5
    
    echo "Step 2: Requesting SSL certificate from Let's Encrypt..."
    docker compose -f compose-selfdeploy.yaml run --rm certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email $ADMIN_EMAIL \
        --agree-tos \
        --no-eff-email \
        -d $DOMAIN \
        -d www.$DOMAIN
    
    echo "SSL certificate obtained!"
    echo ""
    
    echo "Step 3: Configuring nginx with SSL..."
    git checkout nginx/conf.d/lootchat.conf 2>/dev/null || true
    sed "s/\${DOMAIN}/$DOMAIN/g" nginx/conf.d/lootchat.conf > nginx/conf.d/lootchat.conf.tmp
    mv nginx/conf.d/lootchat.conf.tmp nginx/conf.d/lootchat.conf
    rm nginx/conf.d/initial.conf
    
    echo "Step 4: Restarting nginx with SSL configuration..."
    docker compose -f compose-selfdeploy.yaml restart nginx
    
    echo "Step 5: Starting all services..."
    docker compose -f compose-selfdeploy.yaml up -d
fi

echo ""
echo "Deployment complete!"
echo ""
echo "Your LootChat instance is now running at:"
echo "   https://$DOMAIN"
echo ""
echo "Useful commands:"
echo "   View logs:    docker compose -f compose-selfdeploy.yaml logs -f"
echo "   Stop:         docker compose -f compose-selfdeploy.yaml down"
echo "   Restart:      docker compose -f compose-selfdeploy.yaml restart"
echo ""
echo "SSL certificates will auto-renew every 12 hours via certbot"
echo ""
