# Project Setup Steps

## Rules
Use the unique .env that is at the root of the project.
Make a test for each api endpoint in the `server/test/{endpoint}-test.ts` file.

## Phase 1 — Setup
1. Create a `.env` file for environment variables.
2. Initialize a new Node.js project with `npm init`.
3. Install Express and TypeScript.
4. Configure TypeScript (`tsconfig.json`).
5. Install PostgreSQL and Prisma.
6. Set up Prisma schema and generate client.
7. Implement JWT authentication.
8. Install and set up Swagger using `swagger-jsdoc` and `swagger-ui-express`.
9. Set up a custom logger with colorized output and log levels (e.g., info, warn, error) to replace `console.log`.
10. Create a `Dockerfile` for the backend.
11. Create a `docker-compose.yml` for backend and database.

## Phase 2 — Base Models

10. Define the `User` model in Prisma.
11. Define the `Organization` model in Prisma.
12. Define the `Membership` model in Prisma.
13. Define the `Folder` model in Prisma.
14. Define the `Secret` model in Prisma.
15. Define the `SecretVersion` model in Prisma.
16. Define the `AuditLog` model in Prisma.

## Phase 3 — Org Logic

17. Implement organization creation.
18. Implement joining an organization via invite.
19. Implement manual user addition to an organization.
20. Implement membership management and rights assignment.

## Phase 4 — Folder & Permissions Logic

21. Implement CRUD operations for nested folders.
22. Implement permission inheritance logic (org → folders → secrets).
23. Implement support for overriding permissions on folders.

## Phase 5 — Secret Logic

24. Implement CRUD operations for secrets.
25. Implement AES-256-GCM encryption before insert.
26. Implement decryption on read.

## Phase 6 — Versioning & Audit Logs

27. Implement `SecretVersion` model to keep history.
28. Implement `AuditLog` model for access/change events.

## Phase 7 — Frontend

29. Set up React app.
30. Implement authentication flows.
31. Create folder tree UI.
32. Implement secret view/edit/history.
33. Create admin panel to view logs.

## Phase 8 — Dockerization

34. Create a `Dockerfile` for the frontend.
35. Update `docker-compose.yml` to include frontend.
36. Finalize Docker Compose setup for backend, frontend, and database.
