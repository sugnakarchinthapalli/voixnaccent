import React, { useState, useRef, useEffect } from 'react';
import { Camera, Mic, Square, Play, Upload, AlertCircle, CheckCircle, User, Mail } from 'lucide-react';
import { Button } from '../UI/Button';
import { assessmentService } from '../../services/assessmentService';
import { storageService } from '../../services/storageService';
import { questionService } from '../../services/questionService';
import { Question } from '../../types';

type RecordingState = 'idle' | 'recording' | 'stopped' | 'uploading';
type CameraState = 'requesting' | 'granted' | 'denied' | 'error';

export function CandidateRecordingPage() {
  // Basic state
  const [candidateName, setCandidateName] = useState('');
  const [email, setEmail] = useState('');
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [cameraState, setCameraState] = useState<CameraState>('requesting');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [question, setQuestion] = useState<Question | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState(true);
  
  // Media state
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [snapshotTaken, setSnapshotTaken] = useState(false);
  const [snapshotBlob, setSnapshotBlob] = useState<Blob | null>(null);
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadQuestion();
    requestWebcamAccess();
    
    // Cleanup function
    return () => {
      cleanup();
    };
  }, []);

  const loadQuestion = async () => {
    try {
      const randomQuestion = await questionService.getRandomQuestion();
      setQuestion(randomQuestion);
    } catch (error) {
      console.error('Error loading question:', error);
      setError('Failed to load assessment question. Please refresh the page.');
    } finally {
      setLoadingQuestion(false);
    }
  };

  const requestWebcamAccess = async () => {
    try {
      setCameraState('requesting');
      setError('');
      
      // Stop any existing stream first
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        setMediaStream(null);
      }

      console.log('Requesting webcam access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      console.log('Webcam access granted');
      setMediaStream(stream);
      setCameraState('granted');

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Ensure video plays on all browsers
        try {
          await videoRef.current.play();
          console.log('Video playback started successfully');
        } catch (playError) {
          console.warn('Video autoplay failed, but stream is connected:', playError);
          // This is often not critical - user can manually play
        }
      }

    } catch (err) {
      console.error('Error accessing webcam:', err);
      setCameraState('error');
      
      if (err instanceof Error) {
        switch (err.name) {
          case 'NotAllowedError':
            setError('Camera access denied. Please allow camera permissions and refresh the page.');
            break;
          case 'NotFoundError':
            setError('No camera found. Please connect a camera and refresh the page.');
            break;
          case 'NotReadableError':
            setError('Camera is being used by another application or there\'s a hardware issue. Please:\n1. Close all other applications using the camera\n2. Restart your browser\n3. If the issue persists, restart your computer');
            break;
          case 'OverconstrainedError':
            setError('Camera constraints not supported. Please try with a different camera.');
            break;
          default:
            setError(`Camera access failed: ${err.message}`);
        }
      } else {
        setError('Failed to access camera. Please check your camera settings and try again.');
      }
    }
  };

  const handleStartRecording = async () => {
    if (!mediaStream) {
      setError('No media stream available');
      return;
    }

    try {
      setError('');
      
      // Determine the best audio format
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/mp4';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = ''; // Let browser choose
          }
        }
      }

      const options = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(mediaStream, options);
      
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      recorder.onstop = () => {
        console.log('Recording stopped, chunks:', chunks.length);
        setAudioChunks(chunks);
        
        // Create audio URL for review
        if (chunks.length > 0) {
          const audioBlob = new Blob(chunks, { type: mimeType || 'audio/webm' });
          const audioUrl = URL.createObjectURL(audioBlob);
          setRecordedAudioUrl(audioUrl);
          console.log('Audio URL created for review');
        }
      };
      
      recorder.start(1000); // Collect data every second
      setMediaRecorder(recorder);
      setRecordingState('recording');
      
      console.log('Recording started with MIME type:', mimeType || 'browser default');
      
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to start recording. Please try again.');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorder && recordingState === 'recording') {
      mediaRecorder.stop();
      setRecordingState('stopped');
      console.log('Recording stopped');
    }
  };

  const captureSnapshot = async (): Promise<Blob | null> => {
    if (!videoRef.current || !canvasRef.current) {
      console.error('Video or canvas ref not available');
      return null;
    }

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        console.error('Could not get canvas context');
        return null;
      }

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      // Draw current video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert canvas to blob
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) {
            console.log('Snapshot captured successfully');
            setSnapshotTaken(true);
            setSnapshotBlob(blob);
            resolve(blob);
          } else {
            console.error('Failed to create snapshot blob');
            resolve(null);
          }
        }, 'image/jpeg', 0.8);
      });
      
    } catch (error) {
      console.error('Error capturing snapshot:', error);
      return null;
    }
  };

  const handleSubmitAssessment = async () => {
    if (!candidateName.trim() || !email.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    if (audioChunks.length === 0) {
      setError('Please record your response first');
      return;
    }

    if (!snapshotTaken || !snapshotBlob) {
      setError('Identity verification snapshot is required');
      return;
    }

    setRecordingState('uploading');
    setError('');

    try {
      console.log('Starting assessment submission...');
      
      // Ensure storage bucket exists
      await storageService.ensureBucketExists();
      
      // Upload audio file
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      console.log('Uploading audio file...');
      const audioUrl = await storageService.uploadAudioFile(
        new File([audioBlob], `assessment-${Date.now()}.webm`, { type: 'audio/webm' })
      );
      
      // Upload snapshot
      console.log('Uploading snapshot...');
      const snapshotUrl = await storageService.uploadImageFile(
        snapshotBlob,
        `snapshot-${Date.now()}.jpg`
      );
      
      // Create candidate and assessment
      console.log('Creating candidate record...');
      const candidate = await assessmentService.createCandidate({
        name: candidateName.trim(),
        email: email.trim(),
        audio_source: audioUrl,
        source_type: 'manual',
        snapshot_url: snapshotUrl
      });

      // Add to assessment queue
      console.log('Adding to assessment queue...');
      await assessmentService.addToQueue(candidate.id, 10, question?.id);

      console.log('Assessment submitted successfully');
      setSuccess(true);
      
      // Clean up audio URL
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
        setRecordedAudioUrl(null);
      }
      
      // Clean up media stream
      cleanup();

    } catch (err) {
      console.error('Error submitting assessment:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit assessment');
      setRecordingState('stopped');
    }
  };

  const cleanup = () => {
    // Stop media stream
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      setMediaStream(null);
    }
    
    // Clean up audio URL
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
      setRecordedAudioUrl(null);
    }
    
    // Reset media recorder
    if (mediaRecorder) {
      setMediaRecorder(null);
    }
  };

  const retryWebcamAccess = () => {
    requestWebcamAccess();
  };

  // Auto-capture snapshot during recording (random timing)
  useEffect(() => {
    if (recordingState === 'recording' && !snapshotTaken) {
      const randomDelay = Math.random() * 90000 + 15000; // 15-105 seconds
      const timer = setTimeout(() => {
        captureSnapshot();
      }, randomDelay);
      
      return () => clearTimeout(timer);
    }
  }, [recordingState, snapshotTaken]);

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto h-16 w-16 flex items-center justify-center bg-green-100 rounded-full">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Assessment Submitted!</h2>
            <p className="text-gray-600">
              Thank you for completing your voice assessment. Your responses have been recorded and will be evaluated shortly.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loadingQuestion) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading assessment question...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Voice Assessment</h1>
          <p className="text-gray-600">Complete your voice assessment with webcam verification</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Video and Controls */}
          <div className="space-y-6">
            {/* Webcam Section */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Camera className="h-5 w-5 mr-2" />
                Identity Verification
              </h2>
              
              {cameraState === 'requesting' && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Setting up your assessment...</p>
                  <p className="text-sm text-gray-500 mt-2">Please allow camera and microphone access</p>
                </div>
              )}
              
              {cameraState === 'error' && (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <p className="text-red-600 mb-4 whitespace-pre-line">{error}</p>
                  <Button onClick={retryWebcamAccess} variant="outline">
                    Try Again
                  </Button>
                </div>
              )}
              
              {cameraState === 'granted' && (
                <div className="space-y-4">
                  <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    {snapshotTaken && (
                      <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs">
                        ✓ Verified
                      </div>
                    )}
                    {recordingState === 'recording' && (
                      <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs flex items-center">
                        <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse"></div>
                        Recording
                      </div>
                    )}
                  </div>
                  
                  <canvas ref={canvasRef} className="hidden" />
                  
                  {/* Recording Controls */}
                  <div className="flex justify-center space-x-4">
                    {recordingState === 'idle' && (
                      <Button
                        onClick={handleStartRecording}
                        className="flex items-center space-x-2"
                      >
                        <Mic className="h-4 w-4" />
                        <span>Start Recording</span>
                      </Button>
                    )}
                    
                    {recordingState === 'recording' && (
                      <Button
                        onClick={handleStopRecording}
                        variant="danger"
                        className="flex items-center space-x-2"
                      >
                        <Square className="h-4 w-4" />
                        <span>Stop Recording</span>
                      </Button>
                    )}
                    
                    {recordingState === 'stopped' && (
                      <div className="text-center">
                        <div className="flex items-center justify-center text-green-600 mb-2">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          <span className="text-sm">Recording completed</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Audio Review */}
                  {recordedAudioUrl && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-sm font-medium text-gray-900 mb-2">Review Your Recording</h3>
                      <audio controls className="w-full">
                        <source src={recordedAudioUrl} type="audio/webm" />
                        Your browser does not support the audio element.
                      </audio>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Question and Form */}
          <div className="space-y-6">
            {/* Assessment Question */}
            {question && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Assessment Question</h2>
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-gray-700 leading-relaxed">{question.text}</p>
                  <div className="mt-3 flex items-center text-xs text-blue-600">
                    <span className="bg-blue-100 px-2 py-1 rounded">
                      {question.difficulty_level}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Candidate Information */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <User className="h-5 w-5 mr-2" />
                Your Information
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    placeholder="Enter your full name"
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
                    placeholder="your.email@example.com"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Submit Section */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Submit Assessment</h2>
              
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center">
                    <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
                    <p className="text-sm text-red-800 whitespace-pre-line">{error}</p>
                  </div>
                </div>
              )}
              
              <Button
                onClick={handleSubmitAssessment}
                disabled={
                  !snapshotTaken || 
                  audioChunks.length === 0 || 
                  recordingState !== 'stopped' || 
                  recordingState === 'uploading' ||
                  !candidateName.trim() ||
                  !email.trim()
                }
                loading={recordingState === 'uploading'}
                className="w-full flex items-center justify-center space-x-2"
                size="lg"
              >
                <Upload className="h-4 w-4" />
                <span>
                  {recordingState === 'uploading' ? 'Submitting...' : 'Submit Assessment'}
                </span>
              </Button>
              
              <div className="mt-4 text-xs text-gray-500 space-y-1">
                <p>✓ Webcam verification required</p>
                <p>✓ Audio recording required</p>
                <p>✓ All fields must be completed</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}