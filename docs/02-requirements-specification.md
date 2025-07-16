# Project Requirements & Specifications

This document contains the original project vision and technical requirements for Heimdall.

---

## 🎯 **Core Concept**

💥 **Perfect! This makes it even simpler and more flexible — love it.**

---

# ✅ **Simplified Data Structure**

## 🗂️ **Final Data Model**

```
Organization
├── Users (memberships)
│    ├── Rights: view / write / admin
├── Folders (root folders directly under organization, can be nested)
     ├── Secrets
```

---

## 🌳 **Folder Organization**

* **No Projects or Environments** - simplified structure
* **Users organize everything freely with folders**, including folders inside folders
* **Unlimited nesting depth** for maximum flexibility
* You can have a structure like:

```
OrgA
└── Production
    ├── Database
    │   ├── Main DB
    │   └── Analytics DB
    └── API Keys
└── Staging
    ├── Database
```

---

## 🔐 **Permission System**

* **Permissions start at Organization level** (default: view only)
* **Folders inherit org permissions** unless explicitly overridden
* **Secrets inherit permissions** from their parent folder
* **Three permission levels:**
  - `VIEW` - Can read secrets
  - `WRITE` - Can create/edit secrets
  - `ADMIN` - Full access + user management

---

## ✅ **Security Requirements**

* **AES-256-GCM encryption** before saving to database
* **JWT authentication** with configurable expiration
* **bcrypt password hashing** with high salt rounds
* **Comprehensive audit logging** for all actions

---

## 🔎 **Audit & Versioning**

* **Track each secret's changes** (complete history)
* **Track who accessed/modified** each secret
* **Display logs in admin panel** for oversight
* **Secret versioning** with change notes

---

# 🎯 **Technical Specification**

> **We are building a secure secrets management app using Node.js (Express), PostgreSQL, and React. The system supports organizations. A user can create or join an organization. The org owner can invite/add users and assign rights (view, write, admin). Each organization can have folders (nested as needed). Folders store secrets (tokens, passwords, keys, etc.). Secrets are encrypted with AES-256-GCM before DB insert. Secrets have versioning (change history), and every access or change is logged (who, when, what) for auditing. Permissions start at org level (default: view only) and can be overridden on folders. JWT auth. The backend exposes CRUD endpoints for orgs, folders, secrets, and logs. Frontend is React with a nested folder tree UI and secret management pages. All Dockerized. Prisma ORM recommended.**

---

## 🛠️ **Technology Stack**

**Backend:**
- Node.js + Express + TypeScript
- PostgreSQL database
- Prisma ORM
- JWT authentication
- bcrypt for password hashing
- AES-256-GCM for secret encryption

**Frontend:**
- React + TypeScript
- Nested folder tree UI
- Secret management interface
- Admin panel for logs

**Infrastructure:**
- Docker containerization
- Docker Compose for multi-service setup
- Environment-based configuration

---

## 📋 **Functional Requirements**

### User Management
- User registration with email/username
- Secure login with JWT tokens
- Password reset functionality
- User profile management

### Organization Management
- Create organizations
- Invite users via email/manual addition
- Assign user roles (view/write/admin)
- Remove users from organizations

### Folder Management
- Create nested folder structures
- Move folders between parents
- Set folder-specific permissions
- Delete folders (with cascade options)

### Secret Management
- Store various secret types (passwords, API keys, certificates, etc.)
- Encrypt before database storage
- Version control with change history
- Bulk operations for secrets

### Audit & Logging
- Log all user actions
- Track secret access and modifications
- Display audit trails in admin interface
- Export audit logs

---

## 🔒 **Security Requirements**

### Authentication
- JWT tokens with configurable expiration
- Secure password storage with bcrypt
- Session management
- Multi-factor authentication support (future)

### Authorization
- Role-based access control (RBAC)
- Permission inheritance model
- Folder-level permission overrides
- Organization-level default permissions

### Encryption
- AES-256-GCM for secret values
- Secure key management
- Encryption at rest and in transit
- Key rotation capabilities (future)

### Audit
- Complete action logging
- Immutable audit trail
- Compliance reporting
- Data retention policies

---

*This document captures the original vision and requirements for the Heimdall project as defined during initial planning.*
