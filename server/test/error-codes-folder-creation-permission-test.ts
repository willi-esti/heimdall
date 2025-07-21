import request from 'supertest';
import { app } from '../src/index';

async function testFolderErrorCodes() {
  console.log('🧪 Testing folder endpoint error codes...');
  
  // Test with non-existent folder ID
  const nonExistentId = 'non-existent-folder-id-12345';
  const validToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbWRjcmthZHMwMDAwcHZzaWRjcDdpNDAzIiwiZW1haWwiOiJhZG1pbkBnbWFpbC5jb20iLCJpYXQiOjE3NTMwODE4MDYsImV4cCI6MTc1MzY4NjYwNn0.heUcuReaQFpjlP-8WRYzd2fzc5bpYIKDvo1xxhWlEOw';
  
  try {
    // Test update non-existent folder
    console.log('Testing UPDATE non-existent folder...');
    const updateResponse = await request(app)
      .put(`/api/folders/${nonExistentId}`)
      .set('Authorization', validToken)
      .send({ name: 'Test' });
    
    console.log(`✅ Update non-existent folder: ${updateResponse.status} - ${updateResponse.body.error}`);
    
    // Test get non-existent folder
    console.log('Testing GET non-existent folder...');
    const getResponse = await request(app)
      .get(`/api/folders/${nonExistentId}`)
      .set('Authorization', validToken);
    
    console.log(`✅ Get non-existent folder: ${getResponse.status} - ${getResponse.body.error}`);
    
    // Test delete non-existent folder
    console.log('Testing DELETE non-existent folder...');
    const deleteResponse = await request(app)
      .delete(`/api/folders/${nonExistentId}`)
      .set('Authorization', validToken);
    
    console.log(`✅ Delete non-existent folder: ${deleteResponse.status} - ${deleteResponse.body.error}`);
    
    // Test folder path for non-existent folder
    console.log('Testing GET folder path for non-existent folder...');
    const pathResponse = await request(app)
      .get(`/api/folders/${nonExistentId}/path`)
      .set('Authorization', validToken);
    
    console.log(`✅ Get non-existent folder path: ${pathResponse.status} - ${pathResponse.body.error}`);
    
    console.log('🎉 All error code tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testFolderErrorCodes();
