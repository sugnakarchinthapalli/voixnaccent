import { supabase } from '../lib/supabase';

export class StorageService {
  private bucketName = 'voice-assessments';

  async uploadAudioFile(file: File): Promise<string> {
    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `audio/${fileName}`;

      console.log(`Uploading file: ${file.name} (${file.size} bytes) as ${filePath}`);

      // Upload file to Supabase Storage
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Storage upload error:', error);
        throw new Error(`Failed to upload file: ${error.message}`);
      }

      console.log('File uploaded successfully:', data);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(this.bucketName)
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get public URL for uploaded file');
      }

      console.log('Public URL generated:', urlData.publicUrl);
      return urlData.publicUrl;

    } catch (error) {
      console.error('Error uploading audio file:', error);
      throw error;
    }
  }

  async deleteAudioFile(url: string): Promise<void> {
    try {
      // Extract file path from URL
      const urlParts = url.split('/');
      const bucketIndex = urlParts.findIndex(part => part === this.bucketName);
      
      if (bucketIndex === -1) {
        console.warn('Could not extract file path from URL:', url);
        return;
      }

      const filePath = urlParts.slice(bucketIndex + 1).join('/');
      
      const { error } = await supabase.storage
        .from(this.bucketName)
        .remove([filePath]);

      if (error) {
        console.error('Error deleting file:', error);
        // Don't throw error for file deletion failures
      }
    } catch (error) {
      console.error('Error deleting audio file:', error);
      // Don't throw error for file deletion failures
    }
  }

  async ensureBucketExists(): Promise<void> {
    try {
      // Check if we can access the bucket
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .list('', { limit: 1 });

      if (error && error.message.includes('Bucket not found')) {
        throw new Error(`Storage bucket '${this.bucketName}' not found. Please follow the setup instructions in the console.`);
      }

      if (error && !error.message.includes('Bucket not found')) {
        if (error.message.includes('row-level security')) {
          throw new Error('Storage RLS policies not configured. Please follow the setup instructions in the console.');
        }
        console.warn('Storage access check warning:', error);
      }

      console.log('Storage bucket access verified');
    } catch (error) {
      console.error('Error ensuring bucket exists:', error);
      throw error;
    }
  }
}

export const storageService = new StorageService();