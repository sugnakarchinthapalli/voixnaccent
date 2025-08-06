import React, { useState } from 'react';
import { X, Upload, Link, AlertCircle, CheckCircle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Button } from '../UI/Button';
import { assessmentService } from '../../services/assessmentService';
import { storageService } from '../../services/storageService';

function validateAudioSource(audioSource: string): boolean {
  const trimmed = audioSource.trim();
  
  // Check for Vocaroo links
  if (trimmed.includes('voca.ro') || trimmed.includes('vocaroo.com')) {
    return /^https?:\/\/(www\.)?(voca\.ro|vocaroo\.com)\/[a-zA-Z0-9]+/i.test(trimmed);
  }
  
  // Check for direct audio URLs
  if (trimmed.match(/\.(mp3|wav|m4a|ogg|aac)(\?.*)?$/i)) {
    return /^https?:\/\/.+\.(mp3|wav|m4a|ogg|aac)(\?.*)?$/i.test(trimmed);
  }
  
  return false;
}

interface ManualUploadProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function ManualUpload({ onClose, onSuccess }: ManualUploadProps) {
  const [candidateName, setCandidateName] = useState('');
  const [email, setEmail] = useState('');
  const [vocarooLink, setVocarooLink] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [uploadMethod, setUploadMethod] = useState<'file' | 'link'>('file');
  const [uploadProgress, setUploadProgress] = useState(0);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a', '.ogg', '.aac']
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    multiple: false,
    onDrop: (acceptedFiles, rejectedFiles) => {
      if (rejectedFiles.length > 0) {
        setError('Please upload a valid audio file (MP3, WAV, M4A, OGG, AAC) under 50MB');
        return;
      }
      
      if (acceptedFiles.length > 0) {
        setUploadedFile(acceptedFiles[0]);
        setError('');
      }
    }
  });

  const validateForm = () => {
    if (!candidateName.trim()) {
      setError('Please enter candidate name');
      return false;
    }
    
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address');
      return false;
    }

    if (uploadMethod === 'file' && !uploadedFile) {
      setError('Please upload an audio file');
      return false;
    }

    if (uploadMethod === 'link') {
      if (!vocarooLink.trim()) {
        setError('Please enter a Vocaroo link');
        return false;
      }
      
      if (!validateAudioSource(vocarooLink)) {
        setError('Please enter a valid Vocaroo link (e.g., https://voca.ro/abc123 or https://vocaroo.com/abc123)');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setUploading(true);
    setError('');

    try {
      let audioSource = vocarooLink;
      
      if (uploadMethod === 'file' && uploadedFile) {
        console.log('Uploading file to Supabase Storage:', uploadedFile.name);
        setUploadProgress(25);
        
        // Ensure bucket exists
        await storageService.ensureBucketExists();
        setUploadProgress(50);
        
        // Upload file and get public URL
        audioSource = await storageService.uploadAudioFile(uploadedFile);
        setUploadProgress(75);
        
        console.log('File uploaded successfully:', audioSource);
      }

      setUploadProgress(90);

      // Create candidate and add to assessment queue
      const candidate = await assessmentService.createCandidate({
        name: candidateName.trim(),
        email: email.trim(),
        audio_source: audioSource,
        source_type: 'manual' as const
      });

      // Add to queue with high priority (manual uploads get priority)
      await assessmentService.addToQueue(candidate.id, 10);

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 2000);
      
      setUploadProgress(100);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while processing your request');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 text-center">
          <div className="mx-auto h-16 w-16 flex items-center justify-center bg-green-100 rounded-full mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Assessment Queued Successfully!</h3>
          <p className="text-gray-600 mb-4">
            {candidateName}'s assessment has been added to the processing queue. You'll see the results in the dashboard shortly.
          </p>
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="mb-4">
              <div className="bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600 mt-1">Uploading... {uploadProgress}%</p>
            </div>
          )}
          <Button onClick={onSuccess} className="w-full">
            Continue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Manual Assessment Upload</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Candidate Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Candidate Information</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Candidate Name *
              </label>
              <input
                type="text"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                placeholder="Enter candidate's full name"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="candidate@example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Upload Method Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Audio Source</h3>
            
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="link"
                  checked={uploadMethod === 'link'}
                  onChange={(e) => setUploadMethod(e.target.value as 'file' | 'link')}
                  className="mr-2"
                />
                <Link className="h-4 w-4 mr-2" />
                Vocaroo Link
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="file"
                  checked={uploadMethod === 'file'}
                  onChange={(e) => setUploadMethod(e.target.value as 'file' | 'link')}
                  className="mr-2"
                />
                <Upload className="h-4 w-4 mr-2" />
                Upload File
              </label>
            </div>

            {uploadMethod === 'link' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vocaroo Link *
                </label>
                <input
                  type="url"
                  value={vocarooLink}
                  onChange={(e) => setVocarooLink(e.target.value)}
                  placeholder="https://voca.ro/abc123"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-2 text-sm text-gray-500">
                  Enter a valid Vocaroo recording link (voca.ro or vocaroo.com) or direct audio URL
                </p>
                <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
                  <strong>Tip:</strong> Vocaroo links work great and don't require file storage setup
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Audio File *
                </label>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    isDragActive
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <input {...getInputProps()} />
                  {uploadedFile ? (
                    <div className="space-y-2">
                      <CheckCircle className="h-8 w-8 text-green-600 mx-auto" />
                      <p className="text-sm font-medium text-gray-900">{uploadedFile.name}</p>
                      <p className="text-xs text-gray-500">
                        {(uploadedFile.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-8 w-8 text-gray-400 mx-auto" />
                      <p className="text-sm text-gray-600">
                        {isDragActive
                          ? 'Drop the audio file here'
                          : 'Drag & drop an audio file here, or click to select'}
                      </p>
                      <p className="text-xs text-gray-500">
                        Supports MP3, WAV, M4A, OGG, AAC (max 50MB)
                      </p>
                      <div className="mt-2 p-2 bg-yellow-50 rounded text-xs text-yellow-700">
                        <strong>Note:</strong> File uploads require Supabase Storage to be configured
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={uploading}
              disabled={uploading}
              className="relative"
            >
              {uploading ? (
                uploadMethod === 'file' && uploadProgress > 0 ? 
                  `Uploading... ${uploadProgress}%` : 
                  'Processing...'
              ) : 'Start Assessment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}