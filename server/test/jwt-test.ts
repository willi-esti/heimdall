import dotenv from 'dotenv';
import path from 'path';
import { generateToken, verifyToken } from '../src/lib/auth';

// Load environment variables
const envPath = path.join(__dirname, '../../.env');
dotenv.config({ path: envPath });

// Test the JWT functions
console.log('Testing JWT Authentication...\n');

try {
  // Test token generation
  const testUserId = 'test-user-123';
  const testEmail = 'test@example.com';
  
  console.log('1. Generating token...');
  const token = generateToken(testUserId, testEmail);
  console.log('✅ Token generated successfully');
  console.log('Token:', token.substring(0, 50) + '...\n');
  
  // Test token verification
  console.log('2. Verifying token...');
  const decoded = verifyToken(token);
  console.log('✅ Token verified successfully');
  console.log('Decoded payload:', {
    userId: decoded.userId,
    email: decoded.email,
    iat: new Date(decoded.iat! * 1000).toISOString(),
    exp: new Date(decoded.exp! * 1000).toISOString()
  });
  
  console.log('\n🎉 JWT Authentication test passed!');
} catch (error) {
  console.error('❌ JWT Authentication test failed:', error);
}
