#!/bin/bash

# Heimdall Secrets Management - Docker Startup Script

echo "🔐 Starting Heimdall Secrets Management System..."
echo ""

# Function to print colored output
print_status() {
    echo -e "\033[1;34m[INFO]\033[0m $1"
}

print_success() {
    echo -e "\033[1;32m[SUCCESS]\033[0m $1"
}

print_error() {
    echo -e "\033[1;31m[ERROR]\033[0m $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose > /dev/null 2>&1; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

print_status "Stopping any existing containers..."
docker-compose down

print_status "Building and starting all services..."
docker-compose up --build -d

print_status "Waiting for services to be ready..."
sleep 10

# Check if services are running
if docker-compose ps | grep -q "Up"; then
    print_success "Heimdall is starting up!"
    echo ""
    echo "📱 Frontend: http://localhost:3000"
    echo "🚀 Backend API: http://localhost:3001"
    echo "🗄️  Database: localhost:5432"
    echo ""
    echo "📊 To view logs: docker-compose logs -f"
    echo "🛑 To stop: docker-compose down"
    echo "🔄 To restart: docker-compose restart"
    echo ""
    print_status "Showing service status..."
    docker-compose ps
else
    print_error "Some services failed to start. Check logs with: docker-compose logs"
    docker-compose ps
    exit 1
fi
