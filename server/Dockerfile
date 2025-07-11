FROM node:18-alpine

# Install OpenSSL to fix Prisma SSL issues
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including dev dependencies for development)
RUN npm install

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Expose port
EXPOSE 3001

# Start the application in development mode
CMD ["npm", "run", "dev"]
