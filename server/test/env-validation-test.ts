import dotenv from 'dotenv';
import path from 'path';
import { envValidator, EnvValidationError } from '../src/lib/envValidator';

// Load environment variables
const envPath = path.join(__dirname, '../../.env');
dotenv.config({ path: envPath });

console.log('🧪 Testing Environment Validator...\n');

async function testEnvironmentValidator() {
  try {
    console.log('--- Test 1: Current Environment Validation ---');
    const result = envValidator.validateEnvironment();
    
    if (result.isValid) {
      console.log('✅ Current environment is valid!');
    } else {
      console.log('❌ Current environment has errors:');
      result.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    if (result.warnings.length > 0) {
      console.log('⚠️ Warnings:');
      result.warnings.forEach(warning => console.log(`  - ${warning}`));
    }

    console.log('\n--- Test 2: Environment Summary ---');
    const summary = envValidator.getEnvironmentSummary();
    console.log('Current environment configuration:');
    Object.entries(summary).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });

    console.log('\n--- Test 3: Testing with Missing Required Variable ---');
    const originalJwtSecret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    
    try {
      envValidator.validateAndThrow();
      console.log('❌ Should have thrown error for missing JWT_SECRET');
    } catch (error) {
      if (error instanceof EnvValidationError) {
        console.log('✅ Correctly caught missing JWT_SECRET error');
        console.log(`Error: ${error.message.split('\n')[0]}`);
      }
    }
    
    // Restore the variable
    process.env.JWT_SECRET = originalJwtSecret;

    console.log('\n--- Test 4: Testing with Invalid Port ---');
    const originalPort = process.env.PORT;
    process.env.PORT = 'invalid-port';
    
    const invalidPortResult = envValidator.validateEnvironment();
    if (!invalidPortResult.isValid) {
      console.log('✅ Correctly detected invalid port');
      console.log(`Error: ${invalidPortResult.errors[0]}`);
    }
    
    // Restore the variable
    process.env.PORT = originalPort;

    console.log('\n--- Test 5: Testing with Invalid NODE_ENV ---');
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'invalid-env';
    
    const invalidEnvResult = envValidator.validateEnvironment();
    if (!invalidEnvResult.isValid) {
      console.log('✅ Correctly detected invalid NODE_ENV');
      console.log(`Error: ${invalidEnvResult.errors[0]}`);
    }
    
    // Restore the variable
    process.env.NODE_ENV = originalNodeEnv;

    console.log('\n🎉 Environment validator test completed successfully!');

  } catch (error) {
    console.error('❌ Environment validator test failed:', error);
  }
}

// Run the test
testEnvironmentValidator();
