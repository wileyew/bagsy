#!/usr/bin/env node

/**
 * Script to manually create Supabase storage buckets
 * Run this if the migration hasn't created the buckets yet
 * 
 * Usage: node scripts/create-storage-buckets.js
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://uwbkdjmmwmpnxjeuzogo.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.log('Get it from: https://supabase.com/dashboard/project/uwbkdjmmwmpnxjeuzogo/settings/api');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createBuckets() {
  console.log('🚀 Creating storage buckets...\n');

  // List existing buckets
  const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();
  
  if (listError) {
    console.error('❌ Error listing buckets:', listError);
    return;
  }

  console.log('📦 Existing buckets:', existingBuckets.map(b => b.name).join(', ') || 'none');

  const bucketsToCreate = [
    {
      id: 'space-photos',
      name: 'space-photos',
      public: true,
      fileSizeLimit: 10485760, // 10MB
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    },
    {
      id: 'driver-licenses',
      name: 'driver-licenses',
      public: false, // Private bucket
      fileSizeLimit: 10485760, // 10MB
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    }
  ];

  for (const bucket of bucketsToCreate) {
    const exists = existingBuckets.some(b => b.name === bucket.name);
    
    if (exists) {
      console.log(`✅ Bucket '${bucket.name}' already exists`);
      continue;
    }

    console.log(`📦 Creating bucket '${bucket.name}'...`);
    
    const { data, error } = await supabase.storage.createBucket(bucket.id, {
      public: bucket.public,
      fileSizeLimit: bucket.fileSizeLimit,
      allowedMimeTypes: bucket.allowedMimeTypes
    });

    if (error) {
      console.error(`❌ Error creating bucket '${bucket.name}':`, error);
    } else {
      console.log(`✅ Successfully created bucket '${bucket.name}'`);
    }
  }

  console.log('\n✅ Done! Buckets are ready.');
  console.log('\n📝 Next steps:');
  console.log('1. Run the database migration to create RLS policies');
  console.log('2. Test uploading a driver\'s license');
}

createBuckets().catch(console.error);

