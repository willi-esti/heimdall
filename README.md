
# 🔐 Heimdall - Secret Management System

**Heimdall** is a secure, enterprise-grade secrets management application that allows organizations to safely store, organize, and share sensitive information.

[![Status](https://img.shields.io/badge/Status-In%20Development-yellow)](https://github.com/willi-esti/heimdall)
[![Phase](https://img.shields.io/badge/Phase-1%20Infrastructure-blue)](docs/03-development-roadmap.md)
[![Progress](https://img.shields.io/badge/Progress-25%25-green)](docs/03-development-roadmap.md)

---

## 🎯 **What is Heimdall?**

Heimdall enables organizations to:
- **🔒 Store secrets securely** with AES-256-GCM encryption
- **📁 Organize freely** with unlimited nested folder structures  
- **👥 Control access** with granular permissions (view/write/admin)
- **📊 Track everything** with comprehensive audit logs
- **📜 Version control** secret changes with complete history
- **🤝 Collaborate safely** within organization boundaries

---

## 🏗️ **Architecture Overview**

**Tech Stack**: Node.js + Express + TypeScript + PostgreSQL + React + Docker

**Data Model**:
```
Organization
├── Users (with roles: view/write/admin)
└── Folders (nested, unlimited depth)
    └── Secrets (encrypted, versioned, audited)
```

**Security**: JWT auth + bcrypt passwords + AES-256-GCM encryption + RBAC permissions

---

## 🚀 **Quick Start**

### **Prerequisites**
- Node.js 18+
- Docker & Docker Compose
- Git

### **Setup**
```bash
# Clone repository
git clone <repository-url>
cd heimdall

# Start database
docker-compose up heimdall_postgres -d

# Install dependencies
cd server && npm install

# Setup database
npm run db:generate && npm run db:push

# Start development server
npm run dev
```

**Verify**: Visit [http://localhost:3000/health](http://localhost:3000/health)

### **Test the API**
```bash
# Register user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"testuser","password":"test123"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"emailOrUsername":"test@example.com","password":"test123"}'
```

For detailed setup instructions, see [**Getting Started Guide**](docs/05-getting-started.md).

---

## 📁 **Project Structure**

```
heimdall/
├── 📚 docs/                    # Complete project documentation
│   ├── 01-project-overview.md  # Vision and high-level architecture
│   ├── 02-requirements-specification.md  # Detailed requirements
│   ├── 03-development-roadmap.md  # Task tracking and progress
│   ├── 04-architecture-guide.md   # Technical architecture & patterns
│   └── 05-getting-started.md      # Development setup guide
├── 🚀 server/                  # Backend API (Node.js + Express)
│   ├── src/
│   │   ├── controllers/        # HTTP request handlers
│   │   ├── services/           # Business logic
│   │   ├── routes/             # API route definitions  
│   │   └── lib/                # Utilities & middleware
│   ├── test/                   # Test suites
│   └── prisma/                 # Database schema
├── 🎨 frontend/                # React application (planned)
├── 🐳 docker-compose.yml       # Multi-container setup
└── 🔒 .env                     # Environment configuration
```

---

## 📊 **Current Status**

### ✅ **Completed**
- **Infrastructure Setup**: TypeScript + Express + PostgreSQL + Prisma
- **Authentication System**: JWT-based auth with secure password hashing
- **Database Models**: Complete schema with all relationships
- **MVC Architecture**: Clean separation of routes → controllers → services
- **Testing Framework**: Comprehensive test setup with integration tests

### 🔄 **In Progress** 
- **Phase 1**: Swagger documentation, custom logging, Docker setup

### 📋 **Next Up**
- **Phase 3**: Organization management and user invitations
- **Phase 4**: Folder hierarchy and permissions system
- **Phase 5**: Secret encryption and core functionality

**Progress**: 25% complete - See [**Development Roadmap**](docs/03-development-roadmap.md) for details.

---

## 🧪 **Testing**

```bash
# Run all tests
npm test

# Test specific components
npm run test:jwt    # JWT library tests
npm run test:auth   # Authentication endpoint tests

# Test with database
npm run db:seed     # Add test data
```

---

## 🛠️ **Development**

### **Available Scripts**
```bash
npm run dev         # Start development server
npm run build       # Compile TypeScript
npm run db:studio   # Open database GUI
npm run db:migrate  # Run database migrations
```

### **Architecture Pattern**
The project follows **MVC pattern** with clean separation:
- **Routes**: Thin routing layer
- **Controllers**: HTTP request/response handling  
- **Services**: Business logic and data operations
- **Tests**: Comprehensive test coverage

See [**Architecture Guide**](docs/04-architecture-guide.md) for implementation details.

---

## 📚 **Documentation**

| Document | Purpose |
|----------|---------|
| [**Project Overview**](docs/01-project-overview.md) | Vision, goals, and high-level architecture |
| [**Requirements**](docs/02-requirements-specification.md) | Detailed functional and technical requirements |
| [**Roadmap**](docs/03-development-roadmap.md) | Task tracking, progress, and milestones |
| [**Architecture**](docs/04-architecture-guide.md) | Technical design patterns and code organization |
| [**Getting Started**](docs/05-getting-started.md) | Development setup and workflow guide |

---

## 🔒 **Security Features**

- **🔐 Encryption**: AES-256-GCM for secrets, bcrypt for passwords
- **🎫 Authentication**: JWT tokens with configurable expiration
- **🛡️ Authorization**: Role-based access control with permission inheritance
- **📋 Audit Logging**: Complete tracking of all user actions
- **🔄 Versioning**: Full history of secret changes

---

## 🤝 **Contributing**

1. **Check the roadmap** - See what's currently being worked on
2. **Follow the architecture** - Use the established MVC pattern
3. **Add tests** - Include tests for all new functionality
4. **Update docs** - Keep documentation in sync

See [**Getting Started**](docs/05-getting-started.md) for development workflow.

---

## 📄 **License**

[Add your license here]

---

## 🔗 **Links**

- **Documentation**: [`/docs`](docs/)
- **API Health**: [http://localhost:3000/health](http://localhost:3000/health)
- **Database GUI**: `npm run db:studio`
- **Project Repository**: [GitHub](https://github.com/willi-esti/heimdall)

---

*Heimdall - Guarding your secrets with Norse reliability* ⚡