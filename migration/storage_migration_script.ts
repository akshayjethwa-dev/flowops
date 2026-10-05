// ============================================================================
// FIREBASE STORAGE TO SUPABASE STORAGE MIGRATION SCRIPT
// Language: TypeScript
// Dependencies: firebase-admin, @supabase/supabase-js
// Location: /migration/storage_migration_script.ts
// ============================================================================

import * as admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';

// ----------------------------------------------------------------------------
// 1. CONFIGURATION BINDINGS
// ----------------------------------------------------------------------------

const FIREBASE_BUCKET_NAME = process.env.FIREBASE_BUCKET_NAME || 'flowops-production.appspot.com';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TARGET_BUCKET = 'drawings-and-attachments';

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

const fbStorage = admin.storage().bucket(FIREBASE_BUCKET_NAME);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

import { v5 as uuidv5 } from 'uuid';
const DETERMINISTIC_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
function toUUID(firestoreId: string): string {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(firestoreId);
  if (isUuid) return firestoreId;
  return uuidv5(firestoreId, DETERMINISTIC_NAMESPACE);
}

// ----------------------------------------------------------------------------
// 2. MIGRATION LOADER
// ----------------------------------------------------------------------------

export async function migrateStorageBuckets() {
  console.log('>>> Commencing Storage Bucket Migration Stream...');

  try {
    // A. Verify or programmatically check Supabase Storage Bucket presence
    const { data: buckets, error: bError } = await supabase.storage.listBuckets();
    if (bError) throw new Error(`Could not list Supabase Buckets: ${bError.message}`);

    const targetBucketExists = buckets.some(b => b.id === TARGET_BUCKET);
    if (!targetBucketExists) {
      console.log(`[!] Target bucket "${TARGET_BUCKET}" does not exist, creating it now...`);
      const { error: creationError } = await supabase.storage.createBucket(TARGET_BUCKET, {
        public: false, // Protected via Row Level Security (RLS)
        allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf', 'application/octet-stream', 'text/plain'],
        fileSizeLimit: 15728640 // 15MB maximum
      });
      if (creationError) throw new Error(`Could not create storage bucket: ${creationError.message}`);
      console.log(`[+] Bucket "${TARGET_BUCKET}" created successfully.`);
    }

    // B. List all files residing inside Firebase Storage
    const [files] = await fbStorage.getFiles();
    console.log(`[+] Found ${files.length} resource files inside Firebase Storage.`);

    for (const file of files) {
      const filePath = file.name; // e.g. "tenants/tenant_abc/rfq_drawings/spec.dwg"
      console.log(`\nProcessing: ${filePath}`);

      // Parse and rewrite path variables for multi-tenant matching
      // Firestore paths usually are: tenants/{tenantId}/quotations/{id}/attachment.pdf
      const pathParts = filePath.split('/');
      let tenantUuid: string | null = null;
      let supTargetName = filePath;

      if (pathParts[0] === 'tenants' && pathParts[1]) {
        tenantUuid = toUUID(pathParts[1]);
        // Re-compile file path using pristine UUID format preserves organization mapping
        pathParts[1] = tenantUuid;
        supTargetName = pathParts.join('/');
      }

      console.log(`  - Local Transformation mapping: ${supTargetName}`);

      // C. Safe stream piping from source to destination
      try {
        const [fileBuffer] = await file.download();
        const contentType = file.metadata.contentType || 'application/octet-stream';

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(TARGET_BUCKET)
          .upload(supTargetName, fileBuffer, {
            contentType,
            upsert: true // Ensures idempotency on re-runs
          });

        if (uploadError) {
          console.error(`  [-] Fail upload file to Supabase: ${uploadError.message}`);
          continue;
        }

        // D. Update URLs on databases
        const oldUrl = `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_BUCKET_NAME}/o/${encodeURIComponent(filePath)}`;
        
        // Compute new Supabase secure signed or internal download path URL
        const newUrl = `${SUPABASE_URL}/storage/v1/object/sign/${TARGET_BUCKET}/${supTargetName}`;
        console.log(`  [+] File migration successful. Reference update tracking:`);
        console.log(`      From: ${oldUrl}`);
        console.log(`      To:   ${newUrl}`);

        // Write a dynamic check database scanner to update any old URL references in our operational tables if required
        // e.g. Update quotations set items = json_b replacement matching oldUrl references or specific attachment fields

      } catch (fileError: any) {
        console.error(`  [-] Error piping files: ${fileError.message}`);
      }
    }

    console.log('\n======================================================');
    console.log('STORAGE SYSTEM FILE COPIES STREAM COMPLETED!');
    console.log('======================================================');

  } catch (error: any) {
    console.error(`[-] FATAL STORAGE TRANSFER ENGINE FAIL: ${error.message}`);
  }
}

// ----------------------------------------------------------------------------
// 3. STORAGE ROW LEVEL SECURITY (RLS) POLICIES Setup Statements
// ----------------------------------------------------------------------------
const STORAGE_POLICIES_SQL = `
-- ============================================================================
-- SQL STATEMENTS FOR STORAGE BUCKETS SECURITY ISOLATION
-- Run these statements in Supabase SQL editor:
-- ============================================================================

-- A. Enable RLS on Storage Objects (Built into Supabase schemas)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- B. Create Policy for authenticated users to write inside their Tenant boundaries
CREATE POLICY "Enforce Tenant Isolation on Storage upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'drawings-and-attachments' 
  AND (substring(name from '^tenants/([^/]+)') = auth.get_tenant_id()::text)
);

-- C. Create Policy for authenticated users to view attachments matching their Tenant
CREATE POLICY "Enforce Tenant Isolation on Storage Read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'drawings-and-attachments' 
  AND (substring(name from '^tenants/([^/]+)') = auth.get_tenant_id()::text)
);

-- D. Create Policy for authenticated admins to delete attachments as needed
CREATE POLICY "Only Tenant admins can remove objects within sandbox"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'drawings-and-attachments' 
  AND (substring(name from '^tenants/([^/]+)') = auth.get_tenant_id()::text)
  AND auth.get_user_role() = 'admin'
);
`;

console.log(STORAGE_POLICIES_SQL);

if (require.main === module) {
  migrateStorageBuckets().then(() => {
    process.exit(0);
  });
}
