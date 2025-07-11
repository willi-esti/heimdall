@echo off
echo 🔐 Starting Heimdall Secrets Management System...
echo.

echo [INFO] Stopping any existing containers...
docker-compose down

echo [INFO] Building and starting all services...
docker-compose up --build -d

echo [INFO] Waiting for services to be ready...
timeout /t 10 /nobreak > nul

echo [SUCCESS] Heimdall is starting up!
echo.
echo 📱 Frontend: http://localhost:3000
echo 🚀 Backend API: http://localhost:3001
echo 🗄️  Database: localhost:5432
echo.
echo 📊 To view logs: docker-compose logs -f
echo 🛑 To stop: docker-compose down
echo 🔄 To restart: docker-compose restart
echo.
echo [INFO] Showing service status...
docker-compose ps

pause
