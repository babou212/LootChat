#!/bin/bash

# Docker Cleanup Script
# WARNING: This will delete ALL Docker containers, images, networks, and volumes
# Use with caution!

set -e

echo "⚠️  Docker Cleanup Script"
echo "=========================="
echo ""
echo "This script will delete:"
echo "  - All containers (running and stopped)"
echo "  - All images"
echo "  - All networks (except defaults)"
echo "  - All volumes"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo ""
echo "Starting cleanup..."
echo ""

# Stop all running containers
echo "🛑 Stopping all running containers..."
if [ "$(docker ps -q)" ]; then
    docker stop $(docker ps -q)
    echo "✅ All containers stopped"
else
    echo "ℹ️  No running containers to stop"
fi

# Remove all containers
echo ""
echo "🗑️  Removing all containers..."
if [ "$(docker ps -aq)" ]; then
    docker rm $(docker ps -aq)
    echo "✅ All containers removed"
else
    echo "ℹ️  No containers to remove"
fi

# Remove all images
echo ""
echo "🗑️  Removing all images..."
if [ "$(docker images -q)" ]; then
    docker rmi -f $(docker images -q)
    echo "✅ All images removed"
else
    echo "ℹ️  No images to remove"
fi

# Remove all volumes
echo ""
echo "🗑️  Removing all volumes..."
if [ "$(docker volume ls -q)" ]; then
    docker volume rm $(docker volume ls -q)
    echo "✅ All volumes removed"
else
    echo "ℹ️  No volumes to remove"
fi

# Remove all networks (except defaults)
echo ""
echo "🗑️  Removing all custom networks..."
if [ "$(docker network ls --filter type=custom -q)" ]; then
    docker network rm $(docker network ls --filter type=custom -q)
    echo "✅ All custom networks removed"
else
    echo "ℹ️  No custom networks to remove"
fi

# Prune system
echo ""
echo "🧹 Running system prune..."
docker system prune -af --volumes

echo ""
echo "✅ Docker cleanup complete!"
echo ""
echo "System status:"
docker system df
