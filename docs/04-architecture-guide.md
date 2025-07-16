# Code Architecture & Design Patterns

This document explains the architectural decisions, design patterns, and code organization principles used in the Heimdall project.

---

## 🏗️ **Overall Architecture**

Heimdall follows a **layered architecture** with clear separation of concerns, implementing the **MVC (Model-View-Controller)** pattern for the API layer.

```
┌─────────────────────────────────────┐
│            Frontend (React)          │ ← View Layer
├─────────────────────────────────────┤
│              API Layer               │ ← HTTP Interface
│  Routes → Controllers → Services     │
├─────────────────────────────────────┤
│           Business Logic             │ ← Domain Layer
│         Services & Models            │
├─────────────────────────────────────┤
│          Data Access Layer           │ ← Persistence
│       Prisma ORM + PostgreSQL       │
└─────────────────────────────────────┘
```

---

## 📁 **Project Structure**

```
server/
├── src/
│   ├── controllers/          # 🎮 HTTP request handlers
│   │   └── authController.ts # Authentication endpoints
│   ├── services/             # 🧠 Business logic layer  
│   │   └── authService.ts    # Authentication business logic
│   ├── routes/               # 🛤️  Route definitions (thin layer)
│   │   └── auth.ts           # Authentication route mappings
│   ├── lib/                  # 🔧 Utilities & configuration
│   │   ├── auth.ts           # JWT utilities & middleware
│   │   └── prisma.ts         # Database client setup
│   └── index.ts              # 🚀 Application entry point
├── test/                     # 🧪 Test files
│   ├── auth-test.ts          # Auth endpoint integration tests
│   └── jwt-test.ts           # JWT library unit tests
├── prisma/                   # 🗄️  Database schema & migrations
│   ├── schema.prisma         # Database models & relationships
│   └── seed.ts               # Initial data seeding
└── package.json
```

---

## 🔄 **MVC Implementation**

### **Routes** (`src/routes/`)
**Responsibility**: Define API endpoints and apply middleware

```typescript
// routes/auth.ts - Thin routing layer
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authenticateToken, authController.getCurrentUser);
```

**Characteristics**:
- ✅ Minimal logic - just routing
- ✅ Middleware application
- ✅ Clean endpoint definitions
- ❌ No business logic
- ❌ No data validation beyond basic checks

### **Controllers** (`src/controllers/`)
**Responsibility**: Handle HTTP requests and responses

```typescript
// controllers/authController.ts - HTTP concerns
export class AuthController {
  register = async (req: Request, res: Response): Promise<void> => {
    try {
      // 1. Validate request data
      // 2. Call service layer
      // 3. Format response
      // 4. Handle errors
    } catch (error) {
      // HTTP-specific error handling
    }
  };
}
```

**Characteristics**:
- ✅ Request/response handling
- ✅ HTTP status codes
- ✅ Input validation
- ✅ Error formatting
- ❌ No business logic
- ❌ No direct database access

### **Services** (`src/services/`)
**Responsibility**: Business logic and data operations

```typescript
// services/authService.ts - Business logic
export class AuthService {
  async register(data: RegisterData): Promise<AuthResult> {
    // 1. Business rule validation
    // 2. Data processing
    // 3. Database operations
    // 4. Return domain objects
  }
}
```

**Characteristics**:
- ✅ Core business logic
- ✅ Data transformation
- ✅ Database operations via Prisma
- ✅ Domain-specific error handling
- ❌ No HTTP concerns
- ❌ No response formatting

### **Utilities** (`src/lib/`)
**Responsibility**: Shared functionality and configuration

```typescript
// lib/auth.ts - JWT utilities
export const generateToken = (userId: string, email: string): string => { ... }
export const verifyToken = (token: string): JwtPayload => { ... }
export const authenticateToken = (req, res, next) => { ... }
```

---

## 🔒 **Security Architecture**

### **Authentication Flow**
```
1. User credentials → Controller validation
2. Controller → Service (business logic)
3. Service → bcrypt password verification
4. Service → JWT token generation
5. Token → Client (stored securely)
6. Subsequent requests → JWT middleware verification
```

### **Authorization Layers**
```
Organization Level (default permissions)
    ↓ inherits
Folder Level (can override)
    ↓ inherits  
Secret Level (final permissions)
```

### **Encryption Strategy**
- **Passwords**: bcrypt with 12 salt rounds
- **Secrets**: AES-256-GCM before database storage
- **JWT**: Signed with configurable secret
- **Database**: PostgreSQL with SSL in production

---

## 📊 **Data Layer Architecture**

### **Prisma ORM Integration**
```typescript
// Centralized database client
export const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// Used in services for data access
const user = await prisma.user.create({ data: userData });
```

### **Database Relationships**
```
User ←→ Membership ←→ Organization
                ↓
            Folder (nested)
                ↓
            Secret ←→ SecretVersion
                ↓
            AuditLog
```

---

## 🧪 **Testing Architecture**

### **Test Structure**
```
test/
├── {endpoint}-test.ts        # API integration tests
├── {library}-test.ts         # Unit tests for utilities
└── fixtures/                 # Test data and helpers
```

### **Testing Levels**
1. **Unit Tests**: Individual functions and utilities
2. **Integration Tests**: Controller + Service + Database
3. **API Tests**: Full HTTP endpoint testing
4. **End-to-End Tests**: Complete user workflows (future)

### **Test Implementation**
```typescript
// Integration test example
describe('Auth Endpoints', () => {
  it('should register a new user', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send(testUser)
      .expect(201);
    
    expect(response.body.user.email).toBe(testUser.email);
    expect(response.body.token).toBeDefined();
  });
});
```

---

## 🚀 **Deployment Architecture**

### **Containerization Strategy**
```
docker-compose.yml
├── heimdall_postgres (database)
├── heimdall_server (backend API)
└── heimdall_frontend (React app) [future]
```

### **Environment Configuration**
```
Development: Local Node.js + Local PostgreSQL
Testing: Docker Compose with test database
Production: Docker Compose with persistent volumes
```

---

## 📋 **Design Principles**

### **SOLID Principles**
- **S**ingle Responsibility: Each class/function has one purpose
- **O**pen/Closed: Open for extension, closed for modification
- **L**iskov Substitution: Substitutable interfaces
- **I**nterface Segregation: Small, focused interfaces
- **D**ependency Inversion: Depend on abstractions

### **Clean Code Practices**
- ✅ Meaningful naming conventions
- ✅ Small, focused functions
- ✅ Consistent error handling
- ✅ Comprehensive type safety
- ✅ Clear separation of concerns

### **API Design Principles**
- ✅ RESTful endpoints
- ✅ Consistent response formats
- ✅ Proper HTTP status codes
- ✅ Comprehensive error messages
- ✅ Input validation and sanitization

---

## 🔄 **Request Flow Example**

```
POST /api/auth/register
    ↓
1. routes/auth.ts → Route definition
    ↓
2. controllers/authController.ts → HTTP handling
    ↓ (validation, error handling)
3. services/authService.ts → Business logic
    ↓ (password hashing, user creation)
4. prisma → Database operation
    ↓
5. lib/auth.ts → JWT token generation
    ↓
6. Response formatting → Back to client
```

---

## 🎯 **Future Architecture Considerations**

### **Scalability Enhancements**
- Microservices decomposition
- Caching layer (Redis)
- Message queues for async operations
- Load balancing strategies

### **Security Improvements**
- Multi-factor authentication
- API rate limiting
- Advanced audit logging
- Key rotation mechanisms

### **Performance Optimizations**
- Database query optimization
- Response caching
- Connection pooling
- Compression middleware

---

*This architecture document evolves with the project. Last updated: July 14, 2025*
