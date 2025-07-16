# Heimdall Server - Code Organization

This document describes the organized structure of the Heimdall server codebase.

## Project Structure

```
server/
├── src/
│   ├── controllers/          # Route handlers and request/response logic
│   │   └── authController.ts # Authentication controller
│   ├── services/             # Business logic and data processing
│   │   └── authService.ts    # Authentication service
│   ├── routes/               # Route definitions (thin layer)
│   │   └── auth.ts           # Authentication routes
│   ├── lib/                  # Utilities and configuration
│   │   ├── auth.ts           # JWT utilities and middleware
│   │   └── prisma.ts         # Database client
│   └── index.ts              # Application entry point
├── test/                     # Test files
│   ├── auth-test.ts          # Auth endpoint tests
│   └── jwt-test.ts           # JWT library tests
├── prisma/                   # Database schema and migrations
└── package.json
```

## Architecture Pattern: MVC

### Routes (`src/routes/`)
- **Responsibility**: Define API endpoints and attach middleware
- **What they do**: 
  - Route HTTP requests to appropriate controllers
  - Apply middleware (authentication, validation, etc.)
  - Keep thin - no business logic

### Controllers (`src/controllers/`)
- **Responsibility**: Handle HTTP requests and responses
- **What they do**:
  - Validate request data
  - Call appropriate services
  - Format responses
  - Handle HTTP-specific concerns (status codes, headers)
  - Error handling and response formatting

### Services (`src/services/`)
- **Responsibility**: Business logic and data operations
- **What they do**:
  - Implement core business logic
  - Interact with database through Prisma
  - Handle data transformations
  - Throw meaningful errors
  - Reusable across different controllers

### Libraries (`src/lib/`)
- **Responsibility**: Utilities and shared functionality
- **What they do**:
  - JWT utilities (generate, verify tokens)
  - Database connection setup
  - Middleware functions
  - Configuration and constants

## Benefits of This Structure

1. **Separation of Concerns**: Each layer has a clear responsibility
2. **Testability**: Services can be tested independently of HTTP concerns
3. **Reusability**: Services can be used by multiple controllers
4. **Maintainability**: Changes to business logic don't affect route definitions
5. **Scalability**: Easy to add new features following the same pattern

## Example Flow

1. **Route** receives HTTP request → `/api/auth/login`
2. **Route** applies middleware → Authentication middleware (if needed)
3. **Route** calls **Controller** method → `authController.login()`
4. **Controller** validates request → Check required fields
5. **Controller** calls **Service** → `authService.login(emailOrUsername, password)`
6. **Service** executes business logic → Validate credentials, hash comparison
7. **Service** interacts with database → Find user, validate password
8. **Service** returns result → User data + token
9. **Controller** formats response → HTTP status + JSON response
10. **Route** sends response → Back to client

## Testing Strategy

- **Unit Tests**: Test services independently
- **Integration Tests**: Test controller + service together  
- **API Tests**: Test complete HTTP endpoints
- **Library Tests**: Test utility functions

Each endpoint has its own test file in `test/{endpoint}-test.ts` format.
