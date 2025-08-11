import React, { useState, useEffect, useRef } from 'react';
import { Mic, Video, Clock, CheckCircle, AlertCircle, Play, Square, Camera } from 'lucide-react';
import { Button } from '../UI/Button';
import { LoadingSpinner } from '../UI/LoadingSpinner';
import { questionService } from '../../services/questionService';
import { assessmentService } from '../../services/assessmentService';
import { storageService } from '../../services/storageService';
import { Question } from '../../types';

type RecordingState = 'idle' | 'preparing' | 'recording' | 'stopped' | 'uploading' | 'completed' | 'error';

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

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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

  const requestMediaAccess = async () => {
    try {
      setError('');
      setRecordingState('preparing');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      setMediaStream(stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Initialize MediaRecorder with only audio track
      const audioStream = new MediaStream([stream.getAudioTracks()[0]]);
      const recorder = new MediaRecorder(audioStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setAudioChunks(prev => [...prev, event.data]);
        }
      };

      recorder.onstop = () => {
        console.log('Recording stopped');
      };

      setMediaRecorder(recorder);
      setRecordingState('idle');

    } catch (err) {
      console.error('Error accessing media devices:', err);
      setError('Unable to access camera and microphone. Please ensure you have granted permissions and try again.');
      setRecordingState('error');
    }
  };

  const captureSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
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
      }, 'image/jpeg', 0.8); // 80% quality for compression
    });
  };

  const handleStartRecording = async () => {
    if (!validateForm() || !mediaRecorder) return;

    try {
      setError('');
      setRecordingState('recording');
      setTimeRemaining(120);
      setAudioChunks([]);

      // Capture snapshot at random time (between 10-110 seconds)
      const randomSnapshotTime = Math.floor(Math.random() * 100) + 10; // 10-110 seconds
      setTimeout(async () => {
        if (recordingState === 'recording') {
          await captureSnapshot();
          setSnapshotTaken(true);
        }
      }, randomSnapshotTime * 1000);

      mediaRecorder.start(1000); // Collect data every second
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
    }
  };

  const handleSubmitAssessment = async () => {
    if (audioChunks.length === 0) {
      setError('No audio recorded. Please record your response first.');
      return;
    }

    setRecordingState('uploading');
    setError('');

    try {
      // Create audio blob from chunks
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      
      // Capture final snapshot if not taken during recording
      let snapshotBlob: Blob | null = null;
      if (!snapshotTaken) {
        snapshotBlob = await captureSnapshot();
      } else {
        snapshotBlob = await captureSnapshot(); // Take final snapshot anyway
      }

      // Upload audio file
      const audioFile = new File([audioBlob], `recording-${Date.now()}.webm`, {
        type: 'audio/webm'
      });
      
      const audioUrl = await storageService.uploadAudioFile(audioFile);

      // Upload snapshot if available
      let snapshotUrl: string | undefined;
      if (snapshotBlob) {
        const snapshotFile = new File([snapshotBlob], `snapshot-${Date.now()}.jpg`, {
          type: 'image/jpeg'
        });
        snapshotUrl = await storageService.uploadImageFile(snapshotFile);
      }

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
                    onClick={requestMediaAccess}
                    className="w-full flex items-center justify-center space-x-2"
                    size="lg"
                  >
                    <Video className="h-5 w-5" />
                    <span>Start Assessment</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Video Preview and Recording Controls */}
            {mediaStream && (
              <div className="space-y-6">
                {/* Video Preview */}
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full max-w-md mx-auto rounded-lg shadow-md bg-gray-900"
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
                <li>• Your camera will remain on for identity verification</li>
                <li>• Only your audio will be processed for assessment</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}