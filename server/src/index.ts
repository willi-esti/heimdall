import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { prisma } from './lib/prisma';

// Load environment variables from root .env file
// In Docker: .env is mounted directly, in dev: look in parent directory
const envPath = process.env.NODE_ENV === 'production' || process.env.DOCKER 
  ? '.env' 
  : path.join(__dirname, '../../.env');
dotenv.config({ path: envPath });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ 
    message: 'Heimdall Server is running!', 
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint that tests database connection
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await prisma.$connect();
    const userCount = await prisma.user.count();
    const orgCount = await prisma.organization.count();
    
    res.json({
      status: 'healthy',
      database: 'connected',
      stats: {
        users: userCount,
        organizations: orgCount
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Heimdall Server is running on http://localhost:${PORT}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/health`);
});
