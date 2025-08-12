import React, { useState, useRef, useEffect } from 'react';
import { Camera, Mic, Square, Send, AlertCircle, CheckCircle, Clock, User, Mail } from 'lucide-react';
import { Button } from '../UI/Button';
import { questionService } from '../../services/questionService';
import { assessmentService } from '../../services/assessmentService';
import { storageService } from '../../services/storageService';
import { Question } from '../../types';

interface Snapshot {
  id: number;
  blob: Blob;
  timestamp: string;
}

export function CandidateAssessmentPage() {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const firstSnapshotTimerRef = useRef<NodeJS.Timeout | null>(null);
  const secondSnapshotTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Media state
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  
  // Assessment state
  const [question, setQuestion] = useState<Question | null>(null);
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string>('');
  const [loadingQuestion, setLoadingQuestion] = useState(true);
  
  // Constants
  const MAX_RECORDING_TIME = 120; // 2 minutes in seconds

  useEffect(() => {
    initializeCamera();
    fetchRandomQuestion();
    
    // Page navigation protection
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isRecording) {
        e.preventDefault();
        e.returnValue = 'You have an active recording. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    
    const handlePopState = (e: PopStateEvent) => {
      if (isRecording) {
        const confirmLeave = window.confirm('You have an active recording. Are you sure you want to go back?');
        if (!confirmLeave) {
          window.history.pushState(null, '', window.location.href);
        }
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    window.history.pushState(null, '', window.location.href);
    
    return () => {
      cleanup();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isRecording]);

  const fetchRandomQuestion = async () => {
    try {
      setLoadingQuestion(true);
      const randomQuestion = await questionService.getRandomQuestion();
      setQuestion(randomQuestion);
      setError('');
    } catch (err) {
      console.error('Error fetching question:', err);
      setError('Failed to load assessment question. Please refresh the page.');
    } finally {
      setLoadingQuestion(false);
    }
  };

  const initializeCamera = async () => {
    try {
      console.log('Requesting camera and microphone access...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      console.log('Media stream obtained:', stream);
      setMediaStream(stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded, dimensions:', {
            width: videoRef.current?.videoWidth,
            height: videoRef.current?.videoHeight
          });
          setCameraReady(true);
        };
      }
      
      setError('');
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError(`Failed to access camera and microphone: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const startRecording = async () => {
    if (!mediaStream) {
      setError('No media stream available');
      return;
    }

    try {
      console.log('Starting audio recording...');
      
      // Create audio-only stream for recording
      const audioTracks = mediaStream.getAudioTracks();
      const audioStream = new MediaStream(audioTracks);
      
      // Try different MIME types
      const mimeTypes = [
        'audio/webm',
        'audio/mp4',
        'audio/ogg',
        'audio/wav'
      ];
      
      let selectedMimeType = '';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          console.log('Using MIME type:', selectedMimeType);
          break;
        }
      }
      
      const recorder = new MediaRecorder(audioStream, 
        selectedMimeType ? { mimeType: selectedMimeType } : {}
      );
      
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      recorder.onstop = () => {
        console.log('Recording stopped, creating audio blob');
        const audioBlob = new Blob(chunks, { type: selectedMimeType || 'audio/webm' });
        setAudioBlob(audioBlob);
      };
      
      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError('Recording error occurred');
      };
      
      recorder.start(1000);
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);
      setSnapshots([]); // Reset snapshots
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          // Auto-stop at max time
          if (newTime >= MAX_RECORDING_TIME) {
            stopRecording();
            return MAX_RECORDING_TIME;
          }
          return newTime;
        });
      }, 1000);
      
      // Schedule exactly 2 snapshots
      scheduleSnapshots();
      
      console.log('Recording started successfully');
      setError('');
      
    } catch (err) {
      console.error('Error starting recording:', err);
      setError(`Failed to start recording: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      console.log('Stopping recording...');
      mediaRecorder.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      if (firstSnapshotTimerRef.current) {
        clearTimeout(firstSnapshotTimerRef.current);
        firstSnapshotTimerRef.current = null;
      }
      
      if (secondSnapshotTimerRef.current) {
        clearTimeout(secondSnapshotTimerRef.current);
        secondSnapshotTimerRef.current = null;
      }
    }
  };

  const scheduleSnapshots = () => {
    console.log('Scheduling snapshots...');
    
    // First snapshot: 3-8 seconds after start
    const firstSnapshotDelay = Math.random() * 5000 + 3000; // 3-8 seconds
    console.log(`First snapshot scheduled in ${Math.round(firstSnapshotDelay/1000)} seconds`);
    
    firstSnapshotTimerRef.current = setTimeout(() => {
      if (isRecording) {
        console.log('Taking first snapshot...');
        takeSnapshot('first');
      }
    }, firstSnapshotDelay);
    
    // Second snapshot: randomly between 30-90 seconds
    const secondSnapshotDelay = Math.random() * 60000 + 30000; // 30-90 seconds
    console.log(`Second snapshot scheduled in ${Math.round(secondSnapshotDelay/1000)} seconds`);
    
    secondSnapshotTimerRef.current = setTimeout(() => {
      if (isRecording) {
        console.log('Taking second snapshot...');
        takeSnapshot('second');
      }
    }, secondSnapshotDelay);
  };

  const takeSnapshot = (snapshotType: 'first' | 'second') => {
    console.log(`Attempting to take ${snapshotType} snapshot...`);
    
    if (!videoRef.current || !canvasRef.current) {
      console.error('Video or canvas ref not available');
      return;
    }
    
    if (!isRecording) {
      console.error('Not recording, skipping snapshot');
      return;
    }
    
    if (!videoRef.current.videoWidth || !videoRef.current.videoHeight) {
      console.error('Video dimensions not available:', {
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight
      });
      return;
    }
    
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        console.error('Canvas context not available');
        return;
      }
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      console.log(`Canvas dimensions set to: ${canvas.width}x${canvas.height}`);
      
      // Draw current video frame
      ctx.drawImage(video, 0, 0);
      
      // Convert to blob
      canvas.toBlob((blob) => {
        if (blob) {
          const snapshot: Snapshot = {
            id: Date.now(),
            blob,
            timestamp: new Date().toLocaleTimeString()
          };
          
          setSnapshots(prev => {
            const updated = [...prev, snapshot];
            console.log(`${snapshotType} snapshot captured successfully. Total snapshots: ${updated.length}`);
            return updated;
          });
        } else {
          console.error('Failed to create blob from canvas');
        }
      }, 'image/jpeg', 0.8);
      
    } catch (err) {
      console.error('Error taking snapshot:', err);
    }
  };

  const handleSubmitAssessment = async () => {
    // Validation
    if (!candidateName.trim()) {
      setError('Please enter your name');
      return;
    }
    
    if (!candidateEmail.trim() || !candidateEmail.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    
    if (!audioBlob) {
      setError('Please record your answer first');
      return;
    }
    
    if (snapshots.length < 2) {
      setError('Identity verification incomplete. Please ensure recording captured verification snapshots.');
      return;
    }
    
    if (!question) {
      setError('No question available. Please refresh the page.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      console.log('Starting assessment submission...');
      
      // Upload audio file
      console.log('Uploading audio file...');
      const audioUrl = await storageService.uploadAudioFile(
        new File([audioBlob], `recording-${Date.now()}.webm`, { type: audioBlob.type })
      );
      console.log('Audio uploaded:', audioUrl);
      
      // Upload first snapshot for identity verification
      console.log('Uploading identity verification snapshot...');
      const snapshotUrl = await storageService.uploadImageFile(
        snapshots[0].blob,
        `snapshot-${Date.now()}.jpg`
      );
      console.log('Snapshot uploaded:', snapshotUrl);
      
      // Create candidate
      console.log('Creating candidate record...');
      const candidate = await assessmentService.createCandidate({
        name: candidateName.trim(),
        email: candidateEmail.trim(),
        audio_source: audioUrl,
        source_type: 'manual',
        snapshot_url: snapshotUrl
      });
      console.log('Candidate created:', candidate);
      
      // Add to assessment queue
      console.log('Adding to assessment queue...');
      await assessmentService.addToQueue(candidate.id, 10); // High priority for manual submissions
      console.log('Added to queue successfully');
      
      setSubmitted(true);
      
    } catch (err) {
      console.error('Error submitting assessment:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit assessment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const cleanup = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    if (firstSnapshotTimerRef.current) {
      clearTimeout(firstSnapshotTimerRef.current);
    }
    
    if (secondSnapshotTimerRef.current) {
      clearTimeout(secondSnapshotTimerRef.current);
    }
  };

  // Success page
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto h-16 w-16 flex items-center justify-center bg-green-100 rounded-full">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Assessment Submitted!</h2>
            <p className="text-gray-600 mb-4">
              Thank you, {candidateName}! Your voice assessment has been submitted successfully.
            </p>
            <p className="text-sm text-gray-500">
              Our AI system will process your response and you'll receive feedback via email at {candidateEmail}.
            </p>
          </div>
          
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
          >
            Take Another Assessment
          </Button>
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
          <p className="text-gray-600">Complete your voice assessment by answering the question below</p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Question and Form */}
          <div className="space-y-6">
            {/* Assessment Question */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Assessment Question</h2>
              
              {loadingQuestion ? (
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              ) : question ? (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-gray-700 leading-relaxed">{question.text}</p>
                  <div className="mt-3 flex items-center text-xs text-blue-600">
                    <Clock className="h-3 w-3 mr-1" />
                    <span>Maximum 2 minutes to answer</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-500">Failed to load question</p>
                  <Button onClick={fetchRandomQuestion} variant="outline" size="sm" className="mt-2">
                    Retry
                  </Button>
                </div>
              )}
            </div>

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
                    disabled={isRecording || submitting}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={candidateEmail}
                    onChange={(e) => setCandidateEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isRecording || submitting}
                  />
                </div>
              </div>
            </div>

            {/* Identity Verification Notice */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <Camera className="h-5 w-5 text-yellow-600 mr-2 mt-0.5" />
                <div>
                  <h3 className="font-medium text-yellow-800">Identity Verification</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    For security purposes, snapshots will be automatically captured during your recording for identity verification. 
                    These are used only for assessment purposes.
                  </p>
                  <div className="flex items-center space-x-2 mt-2">
                    <div className={`w-3 h-3 rounded-full ${snapshots.length >= 1 ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <div className={`w-3 h-3 rounded-full ${snapshots.length >= 2 ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className="text-xs text-yellow-600">
                      {snapshots.length}/2 verification snapshots captured
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Video and Recording */}
          <div className="space-y-6">
            {/* Video Feed */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Camera className="h-5 w-5 mr-2" />
                Video Feed
              </h2>
              
              <div className="relative bg-gray-900 rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-auto"
                  style={{ maxHeight: '300px' }}
                />
                
                {!cameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75">
                    <div className="text-center text-white">
                      <Camera className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Initializing camera...</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Hidden canvas for snapshots */}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Recording Controls */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Mic className="h-5 w-5 mr-2" />
                Record Your Answer
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`} />
                    <span className="font-medium">
                      {isRecording ? 'Recording...' : audioBlob ? 'Recording Complete' : 'Ready to record'}
                    </span>
                  </div>
                  
                  <div className="font-mono text-lg font-semibold">
                    {formatTime(recordingTime)} / {formatTime(MAX_RECORDING_TIME)}
                  </div>
                </div>
                
                <div className="flex space-x-3">
                  <Button
                    onClick={startRecording}
                    disabled={!cameraReady || isRecording || !question || submitting}
                    className="flex items-center space-x-2"
                  >
                    <Mic className="h-4 w-4" />
                    <span>Start Recording</span>
                  </Button>
                  
                  <Button
                    onClick={stopRecording}
                    disabled={!isRecording}
                    variant="danger"
                    className="flex items-center space-x-2"
                  >
                    <Square className="h-4 w-4" />
                    <span>Stop Recording</span>
                  </Button>
                </div>

                {/* Audio Playback */}
                {audioBlob && (
                  <div className="pt-4 border-t">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Review Your Recording
                    </label>
                    <audio controls className="w-full">
                      <source src={URL.createObjectURL(audioBlob)} type={audioBlob.type} />
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleSubmitAssessment}
              disabled={!audioBlob || !candidateName.trim() || !candidateEmail.trim() || submitting || snapshots.length < 2}
              loading={submitting}
              className="w-full flex items-center justify-center space-x-2"
              size="lg"
            >
              <Send className="h-5 w-5" />
              <span>{submitting ? 'Submitting Assessment...' : 'Submit Assessment'}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}