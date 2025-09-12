import { supabase } from "@/integrations/supabase/client";
import { createComponentDebugger } from "./debug-utils";

const debug = createComponentDebugger('StorageSetup');

export async function setupStorageBuckets() {
  debug.info('Starting storage bucket setup');
  
  try {
    // Check existing buckets
    debug.debug('Checking existing buckets');
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      debug.error('Failed to list buckets', listError);
      throw new Error(`Failed to list buckets: ${listError.message}`);
    }
    
    debug.info('Existing buckets found', { 
      bucketCount: buckets?.length || 0,
      bucketNames: buckets?.map(b => b.name) || []
    });
    
    // Check if space-photos bucket exists
    const spacePhotosBucket = buckets?.find(bucket => bucket.name === 'space-photos');
    
    if (!spacePhotosBucket) {
      debug.info('space-photos bucket not found, creating it');
      
      // Create the space-photos bucket
      const { data: newBucket, error: createError } = await supabase.storage.createBucket('space-photos', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        fileSizeLimit: 10485760, // 10MB limit
      });
      
      if (createError) {
        debug.error('Failed to create space-photos bucket', createError);
        throw new Error(`Failed to create space-photos bucket: ${createError.message}`);
      }
      
      debug.info('space-photos bucket created successfully', { bucket: newBucket });
      
      return {
        success: true,
        message: 'space-photos bucket created successfully',
        bucket: newBucket,
        action: 'created'
      };
    } else {
      debug.info('space-photos bucket already exists', { bucket: spacePhotosBucket });
      
      return {
        success: true,
        message: 'space-photos bucket already exists',
        bucket: spacePhotosBucket,
        action: 'exists'
      };
    }
    
  } catch (error: any) {
    debug.logError(error, { context: 'setup_storage_buckets' });
    return {
      success: false,
      message: error.message || 'Failed to setup storage buckets',
      error: error
    };
  }
}

export async function checkStorageAccess() {
  debug.info('Checking storage access');
  
  try {
    // List buckets to check access
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      debug.error('Storage access check failed', error);
      return {
        success: false,
        message: `Storage access failed: ${error.message}`,
        error
      };
    }
    
    debug.info('Storage access confirmed', { 
      bucketCount: buckets?.length || 0,
      bucketNames: buckets?.map(b => b.name) || []
    });
    
    return {
      success: true,
      message: 'Storage access confirmed',
      buckets: buckets?.map(b => ({ name: b.name, id: b.id, public: b.public })) || []
    };
    
  } catch (error: any) {
    debug.logError(error, { context: 'check_storage_access' });
    return {
      success: false,
      message: error.message || 'Storage access check failed',
      error
    };
  }
}
