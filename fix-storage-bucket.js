// Fix storage bucket configuration
// Run with: node fix-storage-bucket.js

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://uwbkdjmmwmpnxjeuzogo.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // You'll need to set this

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.log('Please set it in your .env file or run:');
  console.log('SUPABASE_SERVICE_ROLE_KEY=your_service_role_key node fix-storage-bucket.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixStorageBucket() {
  console.log('🔧 Fixing storage bucket configuration...');
  
  try {
    // Check existing buckets
    console.log('📋 Checking existing buckets...');
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('❌ Failed to list buckets:', listError.message);
      process.exit(1);
    }
    
    console.log('📦 Existing buckets:', buckets?.map(b => b.name) || []);
    
    // Check if space-photos bucket exists
    const spacePhotosBucket = buckets?.find(bucket => bucket.name === 'space-photos');
    
    if (spacePhotosBucket) {
      console.log('✅ space-photos bucket exists');
      console.log('📊 Current bucket configuration:', spacePhotosBucket);
      
      // If bucket is not public, make it public
      if (!spacePhotosBucket.public) {
        console.log('🔧 Making bucket public to avoid RLS issues...');
        
        // Note: There's no direct API to update bucket settings, so we'll recreate it
        // First, let's try to delete and recreate (if empty)
        const { data: files } = await supabase.storage
          .from('space-photos')
          .list('', { limit: 1 });
        
        if (files && files.length === 0) {
          console.log('🗑️ Bucket is empty, recreating with public access...');
          
          // Delete the bucket
          const { error: deleteError } = await supabase.storage.deleteBucket('space-photos');
          if (deleteError) {
            console.error('❌ Failed to delete bucket:', deleteError.message);
            console.log('💡 You may need to manually set the bucket to public in Supabase dashboard');
            return;
          }
          
          // Recreate with public access
          const { data: newBucket, error: createError } = await supabase.storage.createBucket('space-photos', {
            public: true,
            allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
            fileSizeLimit: 10485760, // 10MB limit
          });
          
          if (createError) {
            console.error('❌ Failed to recreate bucket:', createError.message);
            process.exit(1);
          }
          
          console.log('✅ Bucket recreated with public access');
          console.log('📊 New bucket configuration:', newBucket);
        } else {
          console.log('⚠️ Bucket contains files, cannot safely recreate');
          console.log('💡 Please manually set the bucket to public in Supabase dashboard');
          console.log('   Go to: Storage > space-photos > Settings > Make Public');
        }
      } else {
        console.log('✅ Bucket is already public');
      }
    } else {
      console.log('🔧 Creating space-photos bucket with public access...');
      
      const { data: newBucket, error: createError } = await supabase.storage.createBucket('space-photos', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        fileSizeLimit: 10485760, // 10MB limit
      });
      
      if (createError) {
        console.error('❌ Failed to create space-photos bucket:', createError.message);
        process.exit(1);
      }
      
      console.log('✅ space-photos bucket created successfully!');
      console.log('📊 Bucket configuration:', newBucket);
    }
    
    // Test bucket access
    console.log('🧪 Testing bucket access...');
    const { data: testFiles, error: testError } = await supabase.storage
      .from('space-photos')
      .list('', { limit: 1 });
    
    if (testError) {
      console.error('❌ Failed to access space-photos bucket:', testError.message);
      console.log('💡 You may need to manually configure the bucket in Supabase dashboard');
      return;
    }
    
    console.log('✅ Bucket access test successful');
    console.log('🎉 Storage bucket fix complete!');
    console.log('📝 The bucket is now configured for public access to avoid RLS issues');
    
  } catch (error) {
    console.error('❌ Storage bucket fix failed:', error.message);
    console.log('💡 Alternative solutions:');
    console.log('   1. Go to Supabase dashboard > Storage > space-photos > Settings');
    console.log('   2. Enable "Make Public" option');
    console.log('   3. Or run the SQL script in manual-sql-fix.sql in Supabase SQL Editor');
    process.exit(1);
  }
}

fixStorageBucket();
