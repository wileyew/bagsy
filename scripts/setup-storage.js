// Script to setup Supabase storage buckets
// Run with: node scripts/setup-storage.js

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://uwbkdjmmwmpnxjeuzogo.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // You'll need to set this

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.log('Please set it in your .env file or run:');
  console.log('SUPABASE_SERVICE_ROLE_KEY=your_service_role_key node scripts/setup-storage.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function setupStorage() {
  console.log('🚀 Setting up Supabase storage buckets...');
  
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
    
    if (!spacePhotosBucket) {
      console.log('🔧 Creating space-photos bucket...');
      
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
      console.log('📊 Bucket details:', newBucket);
    } else {
      console.log('✅ space-photos bucket already exists');
      console.log('📊 Bucket details:', spacePhotosBucket);
    }
    
    // Test bucket access
    console.log('🧪 Testing bucket access...');
    const { data: testFiles, error: testError } = await supabase.storage
      .from('space-photos')
      .list('', { limit: 1 });
    
    if (testError) {
      console.error('❌ Failed to access space-photos bucket:', testError.message);
      process.exit(1);
    }
    
    console.log('✅ Bucket access test successful');
    console.log('🎉 Storage setup complete!');
    
  } catch (error) {
    console.error('❌ Storage setup failed:', error.message);
    process.exit(1);
  }
}

setupStorage();
