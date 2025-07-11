# 🔐 Heimdall - Secure Secrets Management

A modern, secure secrets management application built with Node.js, Express, PostgreSQL, and React.

## 🚀 Features

- **Organization-based**: Create and manage organizations with user memberships
- **Flexible Folder Structure**: Organize secrets in nested folders
- **Strong Security**: AES-256-GCM encryption for all secrets
- **Permission System**: Granular permissions with inheritance (view, write, admin)
- **Audit Logging**: Track all access and modifications
- **Version History**: Keep track of secret changes over time
- **Modern UI**: Clean React interface with folder tree navigation

## 🏗️ Architecture

```
Organization
├── Users (memberships)
│    ├── Rights: view / write / admin
├── Folders (root folders directly under organization, can be nested)
     ├── Secrets
```

## 🐳 Quick Start with Docker

### Prerequisites

- Docker
- Docker Compose

### Running the Application

1. **Clone and navigate to the project:**
   ```bash
   git clone <your-repo>
   cd heimdall
   ```

2. **Start all services:**
   ```bash
   docker-compose up -d
   ```

3. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Database: localhost:5432

### Useful Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Rebuild and restart
docker-compose down && docker-compose up --build -d

# Access database directly
docker-compose exec postgres psql -U heimdall_user -d heimdall

# Run Prisma commands
docker-compose exec server npx prisma studio
docker-compose exec server npx prisma db push
docker-compose exec server npx prisma migrate dev
```

## 📊 Database Schema

### Core Models

- **User**: Authentication and user management
- **Organization**: Top-level container for secrets
- **Membership**: User-Organization relationship with permissions
- **Folder**: Nested folder structure for organization
- **Secret**: Encrypted secret storage with metadata
- **SecretVersion**: Version history for secrets
- **AuditLog**: Comprehensive audit trail

## 🔒 Security Features

- **Encryption**: All secrets encrypted with AES-256-GCM before database storage
- **JWT Authentication**: Secure token-based authentication
- **Permission Inheritance**: Permissions flow from Organization → Folders → Secrets
- **Audit Trail**: Complete logging of all access and modifications
- **Rate Limiting**: Protection against brute force attacks

## 🛠️ Development

### Local Development (without Docker)

1. **Setup PostgreSQL database**
2. **Configure environment variables**
3. **Install dependencies and run:**

#### Backend
```bash
cd server
npm install
npx prisma generate
npx prisma db push
npm run dev
```

#### Frontend
```bash
cd client
npm install
npm start
```

### Environment Variables

Create `.env` files in the server directory:

```env
DATABASE_URL=postgresql://heimdall_user:heimdall_password@localhost:5432/heimdall
JWT_SECRET=your-super-secret-jwt-key
ENCRYPTION_KEY=abcdefghijklmnopqrstuvwxyz123456
NODE_ENV=development
PORT=3001
```

## 📝 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user info

### Organizations
- `GET /api/organizations` - List user's organizations
- `POST /api/organizations` - Create organization
- `GET /api/organizations/:id` - Get organization details
- `POST /api/organizations/:id/members` - Add member
- `PUT /api/organizations/:id/members/:userId` - Update member permissions

### Folders
- `GET /api/organizations/:orgId/folders` - List folders
- `POST /api/organizations/:orgId/folders` - Create folder
- `PUT /api/folders/:id` - Update folder
- `DELETE /api/folders/:id` - Delete folder

### Secrets
- `GET /api/folders/:folderId/secrets` - List secrets in folder
- `POST /api/folders/:folderId/secrets` - Create secret
- `GET /api/secrets/:id` - Get secret (decrypted)
- `PUT /api/secrets/:id` - Update secret
- `DELETE /api/secrets/:id` - Delete secret
- `GET /api/secrets/:id/versions` - Get secret version history

### Audit Logs
- `GET /api/organizations/:orgId/audit-logs` - Get audit logs

## 🎯 Roadmap

- [x] Phase 1: Express + TypeScript + PostgreSQL + Prisma setup
- [x] Phase 2: Core data models (User, Organization, Membership, Folder, Secret, etc.)
- [x] Phase 3: Organization logic and membership management
- [x] Phase 4: Folder CRUD and permission inheritance
- [x] Phase 5: Secret CRUD with AES-256-GCM encryption
- [x] Phase 6: Versioning and audit logs
- [x] Phase 7: React frontend with folder tree UI
- [x] Phase 8: Docker containerization
- [ ] Phase 9: Advanced features (bulk operations, import/export, etc.)
- [ ] Phase 10: Production deployment guides

## 📄 License

MIT License - see LICENSE file for details
