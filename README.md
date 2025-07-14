
# Getting Started

1. Install dependencies in the server folder:

    ```bash
    cd server
    npm install
    ```

2. Generate and push the database schema:

    ```bash
    npm run db:generate
    npm run db:push
    ```

3. (Optional) Seed the database inside the Docker container:

    ```bash
    docker exec -it heimdall bash
    npm run db:seed
    ```

4. Open Prisma Studio to inspect your database:

    ```bash
    npm run studio
    ```

5. Start the server and check the health endpoint:

    - Run the server (if not already running):

      ```bash
      npm start
      ```

    - Visit [http://localhost:3000/health](http://localhost:3000/health) to verify everything is working.

