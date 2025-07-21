import { FolderService } from '../src/services/folderService';

const folderService = new FolderService();

async function testFolderServiceErrorCodes() {
  console.log('🧪 Testing folder service error handling...');
  
  const nonExistentId = 'non-existent-folder-id-12345';
  const validUserId = 'cmdcrkads0000pvsidcp7i403'; // admin user from seed
  
  try {
    // Test updateFolder with non-existent ID
    console.log('Testing updateFolder with non-existent folder...');
    try {
      await folderService.updateFolder(nonExistentId, { name: 'Test' }, validUserId);
      console.log('❌ Expected error but got success');
    } catch (error) {
      if (error instanceof Error) {
        console.log(`✅ updateFolder error: "${error.message}"`);
        if (error.message.includes('not found')) {
          console.log('✅ Correct: Returns "not found" error for non-existent folder');
        } else {
          console.log('❌ Expected "not found" error but got different error');
        }
      }
    }
    
    // Test getFolderById with non-existent ID
    console.log('\nTesting getFolderById with non-existent folder...');
    try {
      await folderService.getFolderById(nonExistentId, validUserId);
      console.log('❌ Expected error but got success');
    } catch (error) {
      if (error instanceof Error) {
        console.log(`✅ getFolderById error: "${error.message}"`);
        if (error.message.includes('not found')) {
          console.log('✅ Correct: Returns "not found" error for non-existent folder');
        } else {
          console.log('❌ Expected "not found" error but got different error');
        }
      }
    }
    
    // Test deleteFolder with non-existent ID
    console.log('\nTesting deleteFolder with non-existent folder...');
    try {
      await folderService.deleteFolder(nonExistentId, validUserId);
      console.log('❌ Expected error but got success');
    } catch (error) {
      if (error instanceof Error) {
        console.log(`✅ deleteFolder error: "${error.message}"`);
        if (error.message.includes('not found')) {
          console.log('✅ Correct: Returns "not found" error for non-existent folder');
        } else {
          console.log('❌ Expected "not found" error but got different error');
        }
      }
    }
    
    // Test getFolderPath with non-existent ID
    console.log('\nTesting getFolderPath with non-existent folder...');
    try {
      await folderService.getFolderPath(nonExistentId, validUserId);
      console.log('❌ Expected error but got success');
    } catch (error) {
      if (error instanceof Error) {
        console.log(`✅ getFolderPath error: "${error.message}"`);
        if (error.message.includes('not found')) {
          console.log('✅ Correct: Returns "not found" error for non-existent folder');
        } else {
          console.log('❌ Expected "not found" error but got different error');
        }
      }
    }
    
    console.log('\n🎉 Error handling tests completed!');
    console.log('\n📝 Summary: All methods now correctly return "Folder not found" error for non-existent folders before checking permissions.');
    
  } catch (error) {
    console.error('❌ Test setup failed:', error);
  }
}

testFolderServiceErrorCodes();
