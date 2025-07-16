import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Application } from 'express';
import { log } from './logger';

// Swagger definition
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Heimdall API',
    version: '1.0.0',
    description: 'A comprehensive secret management API for organizations',
    contact: {
      name: 'Heimdall Development Team',
      email: 'support@heimdall.dev',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: process.env.NODE_ENV === 'production' 
        ? 'https://api.heimdall.dev' 
        : `http://localhost:${process.env.PORT || 3000}`,
      description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token in the format: Bearer <token>',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            description: 'Error message',
          },
          details: {
            type: 'string',
            description: 'Additional error details',
          },
        },
        required: ['error'],
      },
      User: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Unique user identifier',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address',
          },
          firstName: {
            type: 'string',
            description: 'User first name',
          },
          lastName: {
            type: 'string',
            description: 'User last name',
          },
          isActive: {
            type: 'boolean',
            description: 'Whether the user account is active',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Account creation timestamp',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp',
          },
        },
        required: ['id', 'email', 'firstName', 'lastName', 'isActive'],
      },
      AuthTokens: {
        type: 'object',
        properties: {
          accessToken: {
            type: 'string',
            description: 'JWT access token',
          },
          refreshToken: {
            type: 'string',
            description: 'JWT refresh token',
          },
          expiresIn: {
            type: 'string',
            description: 'Token expiration duration',
          },
        },
        required: ['accessToken', 'refreshToken', 'expiresIn'],
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
};

// Options for the swagger docs
const swaggerOptions = {
  definition: swaggerDefinition,
  // Path to the API files containing swagger definitions
  apis: [
    './src/routes/*.ts',      // Route files
    './src/controllers/*.ts', // Controller files
    './src/models/*.ts',      // Model files (if we add them)
    './dist/routes/*.js',     // Compiled route files
    './dist/controllers/*.js', // Compiled controller files
  ],
};

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJSDoc(swaggerOptions);

/**
 * Setup Swagger UI for Express app
 * @param app Express application instance
 */
export const setupSwagger = (app: Application): void => {
  // Only enable Swagger in development environment
  if (process.env.NODE_ENV === 'production') {
    log.startup('Swagger documentation disabled in production environment');
    return;
  }

  // Swagger UI options
  const swaggerUiOptions = {
    explorer: true,
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 20px 0; }
      .swagger-ui .info .title { color: #1f2937; }
    `,
    customSiteTitle: 'Heimdall API Documentation',
    swaggerOptions: {
      persistAuthorization: true, // Keep auth token between page refreshes
      displayRequestDuration: true,
      filter: true, // Enable search filter
      showExtensions: true,
      showCommonExtensions: true,
    },
  };

  // Serve swagger docs
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
  
  // Serve swagger spec as JSON
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  log.startup(`Swagger documentation available at http://localhost:${process.env.PORT || 3000}/api-docs`);
  log.startup(`Swagger spec available at http://localhost:${process.env.PORT || 3000}/api-docs.json`);
};

export { swaggerSpec };
export default setupSwagger;
