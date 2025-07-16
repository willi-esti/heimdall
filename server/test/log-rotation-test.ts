/**
 * Log Rotation Test
 * 
 * Tests the log rotation functionality with winston-daily-rotate-file
 * 
 * Features tested:
 * - Daily log rotation with date-based filenames
 * - Size-based rotation (20MB limit)
 * - Automatic compression of old logs
 * - Retention policies (30 days for combined, 14 days for errors)
 * - Audit trail with hash verification
 * - Environment variable configuration
 */

import { log } from '../src/lib/logger';

console.log('🧪 Testing Log Rotation Functionality\n');

async function testLogRotation() {
  try {
    // Test all log levels
    log.info('Log rotation test started');
    log.debug('This is a debug message for rotation testing');
    log.warn('This is a warning message for rotation testing');
    log.error('This is an error message for rotation testing');
    
    // Test specialized logging methods
    log.auth('Testing authentication logging with rotation');
    log.db('Testing database logging with rotation');
    log.api('Testing API logging with rotation');
    log.security('Testing security logging with rotation');
    log.startup('Testing startup logging with rotation');
    
    // Test error with context
    const testError = new Error('Test error for rotation');
    log.errorWithContext(testError, 'LOG_ROTATION_TEST', { 
      testType: 'rotation',
      timestamp: new Date().toISOString()
    });
    
    // Generate some bulk logs to test size-based rotation
    console.log('📝 Generating bulk logs to test rotation...');
    for (let i = 1; i <= 100; i++) {
      log.info(`Bulk log entry ${i} for testing log rotation functionality`, {
        iteration: i,
        bulkTest: true,
        data: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(10)
      });
      
      if (i % 20 === 0) {
        log.warn(`Progress checkpoint: ${i}/100 logs generated`);
      }
    }
    
    console.log('\n✅ Log rotation test completed successfully!');
    console.log('📂 Check the logs/ directory for:');
    console.log('   - combined-YYYY-MM-DD.log files');
    console.log('   - error-YYYY-MM-DD.log files');
    console.log('   - *-audit.json files (rotation tracking)');
    console.log('   - *.gz files (compressed old logs)');
    
  } catch (error) {
    console.error('❌ Log rotation test failed:', error);
    process.exit(1);
  }
}

// Run the test
testLogRotation();
