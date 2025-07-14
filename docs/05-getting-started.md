# Getting Started - Development Setup

This guide will help you set up the Heimdall development environment and understand the basic workflows.

---

## 🔧 **Prerequisites**

Before starting, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** or **yarn** package manager
- **Docker** and **Docker Compose**
- **Git** for version control
- **PostgreSQL** (optional - can use Docker)

---

## 🚀 **Quick Start**

### 1. **Clone the Repository**
```bash
git clone <repository-url>
cd heimdall
```

### 2. **Environment Setup**
The project uses a single `.env` file at the root level:

```bash
# Copy the example environment file
cp .env.example .env

# Edit the .env file with your settings
nano .env
```

**Required Environment Variables:**
```bash
# Database
DATABASE_URL="postgresql://postgres:postgres@heimdall_postgres:5432/heimdall?schema=public"

# JWT Configuration
JWT_SECRET="your-super-secure-jwt-secret-key-change-this-in-production"
JWT_EXPIRES_IN="7d"

# Server
PORT=3000
NODE_ENV="development"

# Encryption
ENCRYPTION_KEY="your-32-character-encryption-key-change-this-in-production!!"
```

### 3. **Install Dependencies**
```bash
cd server
npm install
```

### 4. **Database Setup**

**Option A: Using Docker (Recommended)**
```bash
# Start PostgreSQL container
docker-compose up heimdall_postgres -d

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push
```

**Option B: Local PostgreSQL**
```bash
# Make sure PostgreSQL is running locally
# Update DATABASE_URL in .env to point to local instance

npm run db:generate
npm run db:push
```

### 5. **Seed Database (Optional)**
```bash
npm run db:seed
```

### 6. **Start Development Server**
```bash
npm run dev
```

The server will start on `http://localhost:3000`

---

## 🧪 **Testing the Setup**

### **Health Check**
Visit [http://localhost:3000/health](http://localhost:3000/health) to verify:
- Server is running
- Database connection is working
- Basic stats are displayed

### **API Endpoints**
Test the authentication endpoints:

```bash
# Register a new user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "testpassword123",
    "firstName": "Test",
    "lastName": "User"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "emailOrUsername": "test@example.com",
    "password": "testpassword123"
  }'
```

### **Run Tests**
```bash
# JWT library tests
npm run test:jwt

# Auth endpoint tests
npm run test:auth

# All tests
npm test
```

---

## 📁 **Project Structure**

```
heimdall/
├── 📚 docs/                    # Project documentation
│   ├── 01-project-overview.md
│   ├── 02-requirements-specification.md
│   ├── 03-development-roadmap.md
│   ├── 04-architecture-guide.md
│   └── 05-getting-started.md
├── 🚀 server/                  # Backend application
│   ├── src/
│   │   ├── controllers/        # HTTP request handlers
│   │   ├── services/           # Business logic
│   │   ├── routes/             # API route definitions
│   │   ├── lib/                # Utilities & middleware
│   │   └── index.ts            # Application entry point
│   ├── test/                   # Test files
│   ├── prisma/                 # Database schema
│   └── package.json
├── 🎨 frontend/                # React application (future)
├── 🐳 docker-compose.yml       # Multi-container setup
├── 🔒 .env                     # Environment variables
└── 📖 README.md
```

---

## 💻 **Development Workflow**

### **Making Changes**

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the MVC architecture pattern
   - Add tests for new functionality
   - Update documentation if needed

3. **Test your changes**
   ```bash
   npm run build    # Check compilation
   npm test         # Run test suite
   ```

4. **Commit and push**
   ```bash
   git add .
   git commit -m "feat: your descriptive commit message"
   git push origin feature/your-feature-name
   ```

### **Database Changes**

When modifying the database schema:

1. **Update Prisma schema**
   ```bash
   # Edit prisma/schema.prisma
   nano server/prisma/schema.prisma
   ```

2. **Generate new client**
   ```bash
   npm run db:generate
   ```

3. **Apply changes**
   ```bash
   npm run db:push    # For development
   # OR
   npm run db:migrate # For production-ready migrations
   ```

### **Adding New Endpoints**

Follow the established MVC pattern:

1. **Create/Update Service** (`src/services/`)
   ```typescript
   // Business logic and data operations
   export class YourService {
     async yourMethod(data: YourData): Promise<YourResult> {
       // Implementation
     }
   }
   ```

2. **Create/Update Controller** (`src/controllers/`)
   ```typescript
   // HTTP request/response handling
   export class YourController {
     yourEndpoint = async (req: Request, res: Response): Promise<void> => {
       // HTTP handling + service calls
     };
   }
   ```

3. **Update Routes** (`src/routes/`)
   ```typescript
   // Route definitions
   router.post('/your-endpoint', yourController.yourEndpoint);
   ```

4. **Add Tests** (`test/`)
   ```typescript
   // Create test/{endpoint}-test.ts
   describe('Your Endpoint', () => {
     it('should work correctly', async () => {
       // Test implementation
     });
   });
   ```

---

## 🛠️ **Available Scripts**

### **Development**
```bash
npm run dev          # Start development server with hot reload
npm run build        # Compile TypeScript to JavaScript
npm run start        # Start production server
npm run tsc          # Watch mode TypeScript compilation
```

### **Database**
```bash
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema changes to database
npm run db:migrate   # Create and apply migrations
npm run db:studio    # Open Prisma Studio (database GUI)
npm run db:seed      # Seed database with initial data
```

### **Testing**
```bash
npm test             # Run all tests
npm run test:auth    # Run auth endpoint tests
npm run test:jwt     # Run JWT library tests
```

### **Docker**
```bash
docker-compose up                    # Start all services
docker-compose up heimdall_postgres  # Start only database
docker-compose down                  # Stop all services
docker-compose logs heimdall_server  # View server logs
```

---

## 🔍 **Debugging & Troubleshooting**

### **Common Issues**

**Database Connection Issues:**
```bash
# Check if PostgreSQL is running
docker-compose ps

# View database logs
docker-compose logs heimdall_postgres

# Restart database
docker-compose restart heimdall_postgres
```

**Port Already in Use:**
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

**Environment Variables Not Loading:**
- Ensure `.env` file is at the project root
- Check file permissions
- Restart the development server

### **Useful Commands**

```bash
# Check database schema
npx prisma db pull

# Reset database (destructive!)
npx prisma db reset

# View generated types
npx prisma generate --dry-run

# Database connection test
npx prisma db execute --stdin
```

---

## 📚 **Next Steps**

After setting up the development environment:

1. **Explore the codebase** - Start with `src/index.ts`
2. **Review the tests** - Understand the testing patterns
3. **Check the roadmap** - See what features are planned
4. **Read the architecture guide** - Understand the design patterns

---

**Need Help?**
- Check the [Development Roadmap](03-development-roadmap.md) for current tasks
- Review the [Architecture Guide](04-architecture-guide.md) for design patterns
- Look at existing tests for implementation examples

---

*Happy coding! 🚀*
