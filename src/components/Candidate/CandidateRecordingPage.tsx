import React, { useState, useEffect, useRef } from 'react';
import { Mic, Video, Clock, CheckCircle, AlertCircle, Play, Square, Camera, Shield, XCircle } from 'lucide-react';
import { Button } from '../UI/Button';
import { LoadingSpinner } from '../UI/LoadingSpinner';
import { questionService } from '../../services/questionService';
import { assessmentService } from '../../services/assessmentService';
import { storageService } from '../../services/storageService';
import { Question } from '../../types';

type RecordingState = 'idle' | 'preparing' | 'webcam-blocked' | 'recording' | 'stopped' | 'uploading' | 'completed' | 'error';

export function CandidateRecordingPage() {
  const [candidateName, setCandidateName] = useState('');
  const [email, setEmail] = useState('');
  const [question, setQuestion] = useState<Question | null>(null);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [timeRemaining, setTimeRemaining] = useState(120); // 2 minutes in seconds
  const [error, setError] = useState('');
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [snapshotTaken, setSnapshotTaken] = useState(false);
  const [webcamVerified, setWebcamVerified] = useState(false);
  const [snapshotBlob, setSnapshotBlob] = useState<Blob | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const snapshotTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadQuestion();
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (recordingState === 'recording' && timeRemaining > 0) {
      timerRef.current = setTimeout(() => {
        setTimeRemaining(prev => prev - 1);
      }, 1000);
    } else if (timeRemaining === 0 && recordingState === 'recording') {
      handleStopRecording();
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [recordingState, timeRemaining]);

  const loadQuestion = async () => {
    try {
      const randomQuestion = await questionService.getRandomQuestion();
      setQuestion(randomQuestion);
    } catch (err) {
      console.error('Error loading question:', err);
      setError('Failed to load assessment question. Please refresh the page.');
    }
  };

  const cleanup = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (snapshotTimerRef.current) {
      clearTimeout(snapshotTimerRef.current);
    }
  };

  const validateForm = () => {
    if (!candidateName.trim()) {
      setError('Please enter your full name');
      return false;
    }
    
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address');
      return false;
    }

    return true;
  };

  const requestWebcamAccess = async () => {
    try {
      setError('');
      setRecordingState('preparing');

      // Simple media request - let browser handle defaults
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      setMediaStream(stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Simple play with error handling
        try {
          await videoRef.current.play();
        } catch (playError) {
          console.warn('Video autoplay failed, but stream is ready:', playError);
        }
      }

      // Get audio track for recording
      const audioTracks = stream.getAudioTracks();
      if (!audioTracks.length) {
        throw new Error('No audio track available');
      }
      
      const audioStream = new MediaStream([audioTracks[0]]);
      
      // Simple MIME type selection
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else {
          mimeType = ''; // Let browser choose
        }
      }

      const recorder = new MediaRecorder(audioStream, mimeType ? { mimeType } : {});

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setAudioChunks(prev => [...prev, event.data]);
        }
      };

      recorder.onstop = () => {
        console.log('Recording stopped');
      };

      setMediaRecorder(recorder);
      setWebcamVerified(true);
      setRecordingState('idle');
      
      console.log('Camera and microphone access granted successfully');

    } catch (err) {
      console.error('Error accessing webcam:', err);
      
      let errorMessage = 'Camera and microphone access is required for this assessment. ';
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          errorMessage += 'Please click "Allow" when prompted for camera and microphone permissions.';
        } else if (err.name === 'NotFoundError') {
          errorMessage += 'No camera or microphone found. Please connect these devices and try again.';
        } else if (err.name === 'NotReadableError') {
          errorMessage += 'Camera or microphone is being used by another application. Please close other apps and try again.';
        } else {
          errorMessage += err.message;
        }
      }
      
      setError(errorMessage);
      setRecordingState('webcam-blocked');
    }
  };

  const captureSnapshot = async (): Promise<Blob | null> => {
    if (!videoRef.current || !canvasRef.current || !mediaStream) return null;

    const video = videoRef.current;
    const videoTracks = mediaStream.getVideoTracks();
    
    if (!videoTracks.length || !videoTracks[0].enabled) return null;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to compressed JPEG blob
    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/jpeg', 0.8);
    });
  };

  const scheduleRandomSnapshot = () => {
    // Schedule snapshot at random time between 15-105 seconds
    const randomTime = Math.floor(Math.random() * 90) + 15;
    
    snapshotTimerRef.current = setTimeout(async () => {
      if (recordingState === 'recording' && mediaStream) {
        const snapshot = await captureSnapshot();
        if (snapshot) {
          setSnapshotBlob(snapshot);
          setSnapshotTaken(true);
          console.log('Random snapshot captured');
        }
      }
    }, randomTime * 1000);
  };

  const handleStartRecording = async () => {
    if (!validateForm() || !mediaRecorder || !webcamVerified) return;

    try {
      setError('');
      setRecordingState('recording');
      setTimeRemaining(120);
      setAudioChunks([]);
      setSnapshotTaken(false);
      setSnapshotBlob(null);

      // Schedule random snapshot
      scheduleRandomSnapshot();

      mediaRecorder.start(1000);
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to start recording. Please try again.');
      setRecordingState('idle');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorder && recordingState === 'recording') {
      mediaRecorder.stop();
      setRecordingState('stopped');
      
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      
      if (snapshotTimerRef.current) {
        clearTimeout(snapshotTimerRef.current);
      }

      // If no snapshot was taken during recording, take one now
      if (!snapshotTaken) {
        captureSnapshot().then(snapshot => {
          if (snapshot) {
            setSnapshotBlob(snapshot);
            setSnapshotTaken(true);
          }
        });
      }
    }
  };

  const handleSubmitAssessment = async () => {
    if (audioChunks.length === 0) {
      setError('No audio recorded. Please record your response first.');
      return;
    }

    if (!snapshotBlob) {
      setError('Identity verification failed. Please ensure your camera is working and try again.');
      return;
    }

    setRecordingState('uploading');
    setError('');

    try {
      // Create audio blob from chunks
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

      // Ensure bucket exists before uploading
      await storageService.ensureBucketExists();

      // Upload audio file
      const audioFile = new File([audioBlob], `recording-${Date.now()}.webm`, {
        type: 'audio/webm'
      });
      
      const audioUrl = await storageService.uploadAudioFile(audioFile);

      // Upload snapshot
      const snapshotFile = new File([snapshotBlob], `snapshot-${Date.now()}.jpg`, {
        type: 'image/jpeg'
      });
      const snapshotUrl = await storageService.uploadImageFile(snapshotFile);

      // Create candidate record
      const candidate = await assessmentService.createCandidate({
        name: candidateName.trim(),
        email: email.trim(),
        audio_source: audioUrl,
        source_type: 'manual',
        snapshot_url: snapshotUrl
      });

      // Add to assessment queue with high priority and question ID
      await assessmentService.addToQueue(candidate.id, 10, question?.id);

      setRecordingState('completed');
      
      // Cleanup media stream
      cleanup();

    } catch (err) {
      console.error('Error submitting assessment:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit assessment. Please try again.');
      setRecordingState('stopped');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getRecordingStateMessage = () => {
    switch (recordingState) {
      case 'preparing':
        return 'Requesting camera and microphone access...';
      case 'webcam-blocked':
        return 'Webcam access is required to proceed with the assessment';
      case 'recording':
        return 'Recording in progress - speak clearly and naturally';
      case 'stopped':
        return 'Recording completed - review and submit your assessment';
      case 'uploading':
        return 'Uploading and processing your assessment...';
      case 'completed':
        return 'Assessment submitted successfully!';
      case 'error':
        return 'An error occurred - please try again';
      default:
        return 'Ready to start your voice assessment';
    }
  };

  if (recordingState === 'completed') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto h-16 w-16 flex items-center justify-center bg-green-100 rounded-full">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Assessment Submitted!</h2>
            <div className="space-y-3 text-sm text-gray-600">
              <p>
                Thank you, <span className="font-medium">{candidateName}</span>! Your voice assessment has been submitted successfully.
              </p>
              <p>
                Our AI system is now processing your response. The results will be available to our team shortly.
              </p>
              <p>
                You can now close this window. We'll be in touch regarding next steps.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto h-12 w-12 flex items-center justify-center bg-blue-600 rounded-full mb-4">
            <Mic className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Voice Assessment</h1>
          <p className="text-gray-600">
            Complete your communication skills evaluation
          </p>
        </div>

        {/* Security Notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <Shield className="h-5 w-5 text-amber-600 mr-3" />
            <div>
              <h3 className="font-medium text-amber-800">Identity Verification Required</h3>
              <p className="text-sm text-amber-700 mt-1">
                This assessment requires webcam access for identity verification. Your camera will remain on during the recording to ensure test integrity.
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Question Section */}
          {question && (
            <div className="bg-blue-50 p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Assessment Question</h2>
              <p className="text-gray-700 leading-relaxed">{question.text}</p>
              <div className="mt-3 flex items-center text-sm text-blue-600">
                <Clock className="h-4 w-4 mr-1" />
                <span>Maximum recording time: 2 minutes</span>
              </div>
            </div>
          )}

          <div className="p-6 space-y-6">
            {/* Candidate Information */}
            {recordingState === 'idle' && !mediaStream && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Your Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <div className="pt-4">
                  <Button
                    onClick={requestWebcamAccess}
                    className="w-full flex items-center justify-center space-x-2"
                    size="lg"
                  >
                    <Video className="h-5 w-5" />
                    <span>Enable Camera & Start Assessment</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Webcam Blocked State */}
            {recordingState === 'webcam-blocked' && (
              <div className="text-center py-8">
                <div className="mx-auto h-16 w-16 flex items-center justify-center bg-red-100 rounded-full mb-4">
                  <XCircle className="h-8 w-8 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Camera Access Required</h3>
                <p className="text-gray-600 mb-6">
                  This assessment cannot proceed without webcam access for identity verification.
                </p>
                <Button
                  onClick={requestWebcamAccess}
                  className="flex items-center space-x-2"
                >
                  <Video className="h-4 w-4" />
                  <span>Try Again</span>
                </Button>
              </div>
            )}

            {/* Video Preview and Recording Controls */}
            {mediaStream && webcamVerified && (
              <div className="space-y-6">
                {/* Video Preview */}
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full max-w-md mx-auto rounded-lg shadow-md bg-gray-900 object-cover"
                    style={{ aspectRatio: '16/9' }}
                  />
                  <canvas
                    ref={canvasRef}
                    className="hidden"
                  />
                  
                  {recordingState === 'recording' && (
                    <div className="absolute top-4 left-4 flex items-center space-x-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      <span>REC</span>
                    </div>
                  )}

                  {snapshotTaken && recordingState === 'recording' && (
                    <div className="absolute top-4 right-4 flex items-center space-x-2 bg-green-600 text-white px-3 py-1 rounded-full text-sm">
                      <Camera className="h-3 w-3" />
                      <span>Verified</span>
                    </div>
                  )}

                  <div className="absolute bottom-4 left-4 flex items-center space-x-2 bg-blue-600 text-white px-3 py-1 rounded-full text-xs">
                    <Shield className="h-3 w-3" />
                    <span>Identity Monitoring Active</span>
                  </div>
                </div>

                {/* Timer */}
                {recordingState === 'recording' && (
                  <div className="text-center">
                    <div className="inline-flex items-center space-x-2 bg-gray-100 px-4 py-2 rounded-lg">
                      <Clock className="h-5 w-5 text-gray-600" />
                      <span className="text-xl font-mono font-bold text-gray-900">
                        {formatTime(timeRemaining)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Recording Controls */}
                <div className="flex justify-center space-x-4">
                  {recordingState === 'idle' && (
                    <Button
                      onClick={handleStartRecording}
                      className="flex items-center space-x-2 bg-red-600 hover:bg-red-700"
                      size="lg"
                    >
                      <Play className="h-5 w-5" />
                      <span>Start Recording</span>
                    </Button>
                  )}

                  {recordingState === 'recording' && (
                    <Button
                      onClick={handleStopRecording}
                      variant="outline"
                      className="flex items-center space-x-2 border-red-300 text-red-700 hover:bg-red-50"
                      size="lg"
                    >
                      <Square className="h-5 w-5" />
                      <span>Stop Recording</span>
                    </Button>
                  )}

                  {recordingState === 'stopped' && (
                    <Button
                      onClick={handleSubmitAssessment}
                      className="flex items-center space-x-2"
                      size="lg"
                      disabled={!snapshotTaken}
                    >
                      <CheckCircle className="h-5 w-5" />
                      <span>Submit Assessment</span>
                    </Button>
                  )}
                </div>

                {/* Status Message */}
                <div className="text-center">
                  <p className={`text-sm ${
                    recordingState === 'error' ? 'text-red-600' : 
                    recordingState === 'recording' ? 'text-blue-600' :
                    recordingState === 'completed' ? 'text-green-600' :
                    'text-gray-600'
                  }`}>
                    {getRecordingStateMessage()}
                  </p>
                </div>
              </div>
            )}

            {/* Loading State */}
            {(recordingState === 'preparing' || recordingState === 'uploading') && (
              <div className="text-center py-8">
                <LoadingSpinner size="lg" />
                <p className="mt-4 text-gray-600">
                  {recordingState === 'preparing' ? 'Setting up your assessment...' : 'Processing your submission...'}
                </p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Instructions:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Ensure you're in a quiet environment with good lighting</li>
                <li>• Look directly at the camera and speak clearly</li>
                <li>• You have a maximum of 2 minutes to respond</li>
                <li>• Your camera will remain on for identity verification throughout the assessment</li>
                <li>• A verification snapshot will be captured during recording</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}