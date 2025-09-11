import { supabase } from '@/integrations/supabase/client';
import { createComponentDebugger } from './debug-utils';

const debug = createComponentDebugger('StorageTest');

export interface StorageTestResult {
  success: boolean;
  message: string;
  details?: any;
}

export const testStorageConnection = async (): Promise<StorageTestResult> => {
  try {
    debug.info('Testing storage connection');
    
    // Test 1: Check if we can list buckets
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    
    if (bucketError) {
      debug.error('Failed to list buckets', bucketError);
      return {
        success: false,
        message: `Failed to access storage: ${bucketError.message}`,
        details: bucketError
      };
    }
    
    debug.info('Successfully listed buckets', { buckets: buckets?.map(b => b.name) });
    
    // Test 2: Check if space-photos bucket exists
    const spacePhotosBucket = buckets?.find(bucket => bucket.name === 'space-photos');
    if (!spacePhotosBucket) {
      debug.error('Space photos bucket not found', { 
        availableBuckets: buckets?.map(b => b.name) 
      });
      return {
        success: false,
        message: 'Storage bucket "space-photos" not found. Please create this bucket in your Supabase dashboard.',
        details: { availableBuckets: buckets?.map(b => b.name) }
      };
    }
    
    debug.info('Space photos bucket found', { bucket: spacePhotosBucket });
    
    // Test 3: Try to list files in the bucket (this tests read permissions)
    const { data: files, error: listError } = await supabase.storage
      .from('space-photos')
      .list('', { limit: 1 });
    
    if (listError) {
      debug.error('Failed to list files in bucket', listError);
      return {
        success: false,
        message: `Cannot access space-photos bucket: ${listError.message}`,
        details: listError
      };
    }
    
    debug.info('Successfully accessed space-photos bucket', { fileCount: files?.length || 0 });
    
    return {
      success: true,
      message: 'Storage connection successful',
      details: {
        bucketName: spacePhotosBucket.name,
        bucketId: spacePhotosBucket.id,
        fileCount: files?.length || 0
      }
    };
    
  } catch (error: any) {
    debug.logError(error, { context: 'storage_connection_test' });
    return {
      success: false,
      message: `Storage test failed: ${error.message}`,
      details: error
    };
  }
};

export const testFileUpload = async (testFile: File, userId: string): Promise<StorageTestResult> => {
  try {
    debug.info('Testing file upload', { fileName: testFile.name, fileSize: testFile.size });
    
    const fileName = `test-${userId}-${Date.now()}.txt`;
    
    // Upload test file
    const { data, error } = await supabase.storage
      .from('space-photos')
      .upload(fileName, testFile);
    
    if (error) {
      debug.error('Test upload failed', error);
      return {
        success: false,
        message: `Upload test failed: ${error.message}`,
        details: error
      };
    }
    
    debug.info('Test upload successful', { fileName, data });
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('space-photos')
      .getPublicUrl(fileName);
    
    debug.info('Test file public URL generated', { fileName, publicUrl });
    
    // Clean up test file
    try {
      await supabase.storage
        .from('space-photos')
        .remove([fileName]);
      debug.info('Test file cleaned up', { fileName });
    } catch (cleanupError) {
      debug.warn('Failed to clean up test file', { fileName, error: cleanupError });
    }
    
    return {
      success: true,
      message: 'File upload test successful',
      details: {
        fileName,
        publicUrl,
        fileSize: testFile.size
      }
    };
    
  } catch (error: any) {
    debug.logError(error, { context: 'file_upload_test' });
    return {
      success: false,
      message: `File upload test failed: ${error.message}`,
      details: error
    };
  }
};

export const runFullStorageTest = async (userId: string): Promise<StorageTestResult> => {
  debug.info('Running full storage test', { userId });
  
  // Test 1: Connection test
  const connectionTest = await testStorageConnection();
  if (!connectionTest.success) {
    return connectionTest;
  }
  
  // Test 2: File upload test
  const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
  const uploadTest = await testFileUpload(testFile, userId);
  if (!uploadTest.success) {
    return uploadTest;
  }
  
  return {
    success: true,
    message: 'All storage tests passed',
    details: {
      connection: connectionTest.details,
      upload: uploadTest.details
    }
  };
};
