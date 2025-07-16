# Heimdall - Secret Management System

**Heimdall** is a secure, enterprise-grade secrets management application that allows organizations to safely store, organize, and share sensitive information like passwords, API keys, certificates, and other secrets.

## 🎯 **Project Vision**

A flexible, secure secrets management platform where organizations can:
- **Store secrets securely** with AES-256-GCM encryption
- **Organize freely** with nested folder structures
- **Control access** with granular permissions (view/write/admin)
- **Track everything** with comprehensive audit logs
- **Version control** secret changes with history
- **Collaborate safely** within organization boundaries

## 🏗️ **Architecture Overview**

**Tech Stack:**
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Frontend**: React + TypeScript
- **Authentication**: JWT tokens
- **Encryption**: AES-256-GCM
- **Deployment**: Docker + Docker Compose

**Data Model:**
```
Organization
├── Users (memberships with roles: view/write/admin)
└── Folders (nested, unlimited depth)
    └── Secrets (encrypted, versioned, audited)
```

## 🔐 **Security Features**

- **End-to-end encryption** with AES-256-GCM
- **JWT-based authentication** with configurable expiration
- **Role-based access control** (Organization → Folders → Secrets)
- **Permission inheritance** with override capabilities
- **Comprehensive audit logging** for all actions
- **Password hashing** with bcrypt (12 salt rounds)
- **Secret versioning** for change tracking

## 📁 **Repository Structure**

```
heimdall/
├── docs/                    # 📚 Project documentation & memory
├── server/                  # 🚀 Backend API (Node.js + Express)
│   ├── src/
│   │   ├── controllers/     # HTTP request handlers
│   │   ├── services/        # Business logic
│   │   ├── routes/          # API routes
│   │   ├── lib/             # Utilities & middleware
│   │   └── index.ts         # App entry point
│   ├── test/                # Unit & integration tests
│   ├── prisma/              # Database schema & migrations
│   └── package.json
├── .env                     # Environment variables
├── docker-compose.yml       # Multi-container setup
└── README.md
```

## 🚀 **Current Status**

**✅ Completed:**
- Project setup & TypeScript configuration
- PostgreSQL + Prisma integration
- JWT authentication system
- MVC architecture implementation
- Code organization & structure
- Comprehensive testing setup

**🔄 In Progress:**
- Phase 1 completion (Swagger, logging, Docker)

**📋 Next Steps:**
- Complete Phase 1 (Swagger API docs, custom logger)
- Implement Phase 2 (Base models complete)
- Build Phase 3 (Organization logic)

## 📊 **Development Phases**

1. **Phase 1 - Setup** (Infrastructure & tools)
2. **Phase 2 - Base Models** (Database design)
3. **Phase 3 - Organization Logic** (User management)
4. **Phase 4 - Folder & Permissions** (Access control)
5. **Phase 5 - Secret Logic** (Core functionality)
6. **Phase 6 - Versioning & Audit** (History & tracking)
7. **Phase 7 - Frontend** (React application)
8. **Phase 8 - Dockerization** (Production deployment)

---

*This document serves as the central reference for the Heimdall project. For detailed information, see the specific documentation files in this folder.*
