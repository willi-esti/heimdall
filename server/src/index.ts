import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { prisma } from './lib/prisma';
import { log } from './lib/logger';
import { setupSwagger } from './lib/swagger';
import authRoutes from './routes/auth';

// Load environment variables from root .env file
// In Docker: .env is mounted directly, in dev: look in parent directory
const envPath = process.env.NODE_ENV === 'production' || process.env.DOCKER 
  ? '.env' 
  : path.join(__dirname, '../../.env');
dotenv.config({ path: envPath });

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // In development, allow all origins
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // In production, use environment variable for allowed origins
    const allowedOrigins = process.env.CORS_ORIGINS 
      ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
      : [
          'http://localhost:3000',
        ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      log.security('CORS: Origin not allowed', { origin, userAgent: 'N/A' });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies to be sent
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(cors(corsOptions));

// Request logging middleware
app.use((req, res, next) => {
  log.request(req, res);
  next();
});

// Middleware
app.use(express.json());

// Security: Block documentation routes in production
if (process.env.NODE_ENV === 'production') {
  app.use('/api-docs*', (req, res) => {
    log.security('Attempted access to documentation in production', { ip: req.ip, userAgent: req.get('User-Agent') });
    res.status(404).json({ error: 'Not found' });
  });
}

// Setup Swagger documentation
setupSwagger(app);

// Routes
app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
  log.api('Root endpoint accessed');
  
  // Base response
  const response: any = {
    message: 'Heimdall Server is running!', 
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        me: 'GET /api/auth/me (protected)',
        refresh: 'POST /api/auth/refresh (protected)'
      }
    }
  };

  // Only include documentation links in development
  if (process.env.NODE_ENV !== 'production') {
    response.documentation = {
      swagger: '/api-docs',
      spec: '/api-docs.json'
    };
  }

  res.json(response);
});

// Health check endpoint that tests database connection
app.get('/health', async (req, res) => {
  try {
    log.db('Testing database connection for health check');
    
    // Test database connection
    await prisma.$connect();
    const userCount = await prisma.user.count();
    const orgCount = await prisma.organization.count();
    
    const healthData = {
      status: 'healthy',
      database: 'connected',
      stats: {
        users: userCount,
        organizations: orgCount
      },
      timestamp: new Date().toISOString()
    };
    
    log.info('Health check passed', healthData);
    res.json(healthData);
  } catch (error) {
    log.errorWithContext(error instanceof Error ? error : new Error(String(error)), 'Health Check');
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
  log.startup('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  log.startup(`Heimdall Server is running on http://${process.env.HOST || 'localhost'}:${PORT}`);
  log.startup(`API documentation available at http://${process.env.HOST || 'localhost'}:${PORT}/api-docs`);
  log.startup(`API spec available at http://${process.env.HOST || 'localhost'}:${PORT}/api-docs.json`);
  log.startup(`CORS enabled for origins: ${process.env.CORS_ORIGINS || 'all'}`);
  log.startup(`Environment: ${process.env.NODE_ENV}`);
  log.startup(`Health check available at http://localhost:${PORT}/health`);
  log.info('Server initialization complete', {
    port: PORT,
    nodeEnv: process.env.NODE_ENV,
    logLevel: process.env.LOG_LEVEL,
  });
});
