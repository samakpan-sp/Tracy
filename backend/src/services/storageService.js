import { supabaseAdmin } from '../lib/supabaseClient.js';

const BUCKET = 'investigation-evidence';

export async function uploadEvidenceFile({ userId, fileBuffer, originalName, mimeType }) {
  const timestamp = Date.now();
  const path = `${userId}/${timestamp}-${originalName}`;

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, fileBuffer, { contentType: mimeType, upsert: false });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  return path;
}