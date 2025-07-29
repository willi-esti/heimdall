import dotenv from 'dotenv';
import path from 'path';
import { log } from '../src/lib/logger';

// Load environment variables
const envPath = path.join(__dirname, '../../.env');
dotenv.config({ path: envPath });

console.log('🧪 Testing Enhanced Logger with File Information...\n');

async function testLogger() {
  try {
    // Test different log levels - these should now show file and line info
    log.debug('This is a debug message with file information');
    log.info('This is an info message showing file location');
    log.warn('This is a warning message with file tracking');
    log.error('This is an error message with file details');
    log.http('This is an HTTP log with file information');

    console.log('\n--- Testing specialized logging methods ---\n');

    // Test specialized logging methods
    log.auth('User authentication successful', { userId: 'user-123', email: 'test@example.com' });
    log.db('Database query executed', { table: 'users', operation: 'SELECT', duration: '45ms' });
    log.api('API endpoint accessed', { method: 'POST', path: '/api/auth/login' });
    log.security('Suspicious activity detected', { ip: '192.168.1.100', attempts: 5 });
    log.startup('Server component initialized', { component: 'database', status: 'ready' });

    console.log('\n--- Testing error logging with context ---\n');

    // Test error logging with context
    const testError = new Error('This is a test error for demonstration');
    log.errorWithContext(testError, 'Test Context', { 
      userId: 'user-456', 
      action: 'testing logger' 
    });

    console.log('\n--- Testing structured logging ---\n');

    // Test with complex objects
    log.info('Complex data structure logged', {
      user: {
        id: 'user-789',
        email: 'complex@example.com',
        permissions: ['read', 'write'],
        metadata: {
          lastLogin: new Date().toISOString(),
          sessionCount: 42
        }
      },
      request: {
        method: 'GET',
        url: '/api/users/profile',
        headers: {
          'user-agent': 'Test Client 1.0',
          'authorization': 'Bearer [REDACTED]'
        }
      }
    });

    console.log('\n🎉 Logger test completed successfully!');
    console.log('\n📁 Check the following files for logged output:');
    console.log('   - logs/combined.log (all logs)');
    console.log('   - logs/error.log (errors only)');
    console.log('   - Console output (formatted with colors and emojis)');

  } catch (error) {
    console.error('❌ Logger test failed:', error);
  }
}

// Run the test
testLogger();
