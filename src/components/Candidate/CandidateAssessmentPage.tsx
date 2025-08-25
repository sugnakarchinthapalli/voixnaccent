import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Camera, Mic, Square, Send, AlertCircle, CheckCircle, Clock, User, Mail, Timer } from 'lucide-react';
import { Button } from '../UI/Button';
import { questionService } from '../../services/questionService';
import { candidateSubmissionService } from '../../services/candidateSubmissionService';
import { storageService } from '../../services/storageService';
import { supabase } from '../../lib/supabase';
import { Question, Candidate } from '../../types';

interface Snapshot {
  id: number;
  blob: Blob;
  timestamp: string;
}

export function CandidateAssessmentPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const firstSnapshotTimerRef = useRef<NodeJS.Timeout | null>(null);
  const secondSnapshotTimerRef = useRef<NodeJS.Timeout | null>(null);
  const questionTextRef = useRef<HTMLDivElement>(null);
  
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
  const [candidateData, setCandidateData] = useState<Candidate | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string>('');
  const [loadingQuestion, setLoadingQuestion] = useState(true);
  const [loadingCandidate, setLoadingCandidate] = useState(true);
  
  // Timer state
  const [timeRemaining, setTimeRemaining] = useState(180); // 3 minutes in seconds
  const [assessmentExpired, setAssessmentExpired] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  
  // Proctoring state
  const [tabFocusLost, setTabFocusLost] = useState(false);
  
  // Constants
  const MAX_RECORDING_TIME = 120; // 2 minutes in seconds
  const ASSESSMENT_DURATION = 180; // 3 minutes in seconds

  useEffect(() => {
    if (!sessionId) {
      setError('Invalid assessment link. Please contact your administrator.');
      return;
    }

    initializeAssessment();
    initializeCamera();
    setupProctoring();
    
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
      console.log('Component unmounting, cleaning up...');
      cleanup();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [sessionId]);

  const initializeAssessment = async () => {
    try {
      console.log('🔍 Initializing assessment for session:', sessionId);
      
      // Fetch candidate data using the assessment link ID (session ID)
      const { data: candidate, error: candidateError } = await supabase
        .from('candidates')
        .select('*')
        .eq('assessment_link_id', sessionId)
        .single();

      if (candidateError || !candidate) {
        console.error('❌ Candidate not found:', candidateError);
        setError('Invalid assessment link or assessment not found. Please contact your administrator.');
        setLoadingCandidate(false);
        return;
      }

      console.log('✅ Candidate found:', candidate);
      setCandidateData(candidate);

      // Validate assessment status and expiry
      if (candidate.assessment_status === 'completed') {
        setError('This assessment has already been submitted.');
        setLoadingCandidate(false);
        return;
      }

      if (candidate.assessment_status === 'expired') {
        setError('Assessment link expired. Email ta@mediamint.com for a new link.');
        setAssessmentExpired(true);
        setLoadingCandidate(false);
        return;
      }

      // Check session expiry time
      if (candidate.session_expires_at && new Date() > new Date(candidate.session_expires_at)) {
        // Update status to expired in database
        await supabase
          .from('candidates')
          .update({ assessment_status: 'expired' })
          .eq('id', candidate.id);
          
        setError('Assessment link expired. Email ta@mediamint.com for a new link.');
        setAssessmentExpired(true);
        setLoadingCandidate(false);
        return;
      }

      // Initialize assessment timer (3 minutes total)
      initializeTimer();
      
      // Update candidate status to in_progress when they access the assessment
      await supabase
        .from('candidates')
        .update({ assessment_status: 'in_progress' })
        .eq('id', candidate.id);

      setLoadingCandidate(false);
      
      // Load a random assessment question
      await fetchRandomQuestion();
      
    } catch (err) {
      console.error('❌ Error initializing assessment:', err);
      setError('Failed to initialize assessment. Please try again.');
      setLoadingCandidate(false);
    }
  };

  /**
   * Initializes and manages the 3-minute assessment timer
   * Uses localStorage to persist timer across page refreshes
   */
  const initializeTimer = () => {
    const storageKey = `assessmentStartTime_${sessionId}`;
    const storedStartTime = localStorage.getItem(storageKey);
    
    let startTime: number;
    
    if (storedStartTime) {
      startTime = parseInt(storedStartTime, 10);
      console.log('📅 Found existing start time:', new Date(startTime));
    } else {
      startTime = Date.now();
      localStorage.setItem(storageKey, startTime.toString());
      console.log('📅 Set new start time:', new Date(startTime));
    }
    
    setSessionStartTime(startTime);
    if (!storedStartTime) {
  await supabase.from('candidates').update({ first_accessed_at: new Date().toISOString() }).eq('id', candidateData.id);
}
    
    // Start countdown timer
    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, ASSESSMENT_DURATION - elapsed);
      
      setTimeRemaining(remaining);
      
      if (remaining <= 0) {
  console.log('⏰ Assessment time expired');
  // Mark link as expired due to timeout
  await supabase.from('candidates').update({ assessment_status: 'expired' }).eq('assessment_link_id', sessionId);
  setAssessmentExpired(true);
  localStorage.removeItem(storageKey);
  return;
}
      
      setTimeout(updateTimer, 1000);
    };
    
    updateTimer();
  };

  /**
   * Sets up proctoring features including tab focus detection and copy protection
   */
  const setupProctoring = () => {
    // Detect when user switches tabs or minimizes window
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        console.log('🚨 Tab focus lost detected');
        setTabFocusLost(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Prevent copying of assessment question text
    const preventCopyEvents = (e: Event) => {
      e.preventDefault();
      return false;
    };

    const questionElement = questionTextRef.current;
    if (questionElement) {
      questionElement.addEventListener('copy', preventCopyEvents);
      questionElement.addEventListener('cut', preventCopyEvents);
      questionElement.addEventListener('selectstart', preventCopyEvents);
      questionElement.addEventListener('contextmenu', preventCopyEvents);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (questionElement) {
        questionElement.removeEventListener('copy', preventCopyEvents);
        questionElement.removeEventListener('cut', preventCopyEvents);
        questionElement.removeEventListener('selectstart', preventCopyEvents);
        questionElement.removeEventListener('contextmenu', preventCopyEvents);
      }
    };
  };

  /**
   * Fetches a random assessment question from the database
   */
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

  /**
   * Initializes camera and microphone access for recording
   */
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

  /**
   * Starts audio recording with automatic snapshot scheduling
   */
  const startRecording = async () => {
    if (!mediaStream || assessmentExpired) {
      setError('Cannot start recording - assessment expired or no media stream available');
      return;
    }

    try {
      console.log('Starting audio recording...');
      
      const audioTracks = mediaStream.getAudioTracks();
      const audioStream = new MediaStream(audioTracks);
      
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
      setSnapshots([]);
      setError('');
      
      console.log('Starting recording timer...');
      const startTime = Date.now();
      
      const updateTimer = () => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        console.log(`Timer update: ${elapsed}s`);
        setRecordingTime(elapsed);
        
        if (elapsed >= MAX_RECORDING_TIME) {
          console.log('Max recording time reached, stopping...');
          stopRecording();
          return;
        }
        
        timerRef.current = setTimeout(updateTimer, 1000);
      };
      
      timerRef.current = setTimeout(updateTimer, 1000);
      
      // Schedule snapshots
      console.log('📸 Scheduling snapshots...');
      
      // First snapshot after 5 seconds
      setTimeout(() => {
        console.log('📸 Time for first snapshot!');
        takeSnapshot('first');
      }, 5000);
      
      // Second snapshot after 20 seconds
      setTimeout(() => {
        console.log('📸 Time for second snapshot!');
        takeSnapshot('second');
      }, 20000);
      
      console.log('Recording started successfully');
      
    } catch (err) {
      console.error('Error starting recording:', err);
      setError(`Failed to start recording: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  /**
   * Stops the current recording and clears all timers
   */
  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      console.log('Stopping recording...');
      mediaRecorder.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearTimeout(timerRef.current);
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
      
      console.log('Recording stopped and timers cleared');
    }
  };

  /**
   * Captures a webcam snapshot for identity verification
   */
  const takeSnapshot = (snapshotType: 'first' | 'second') => {
    console.log(`📸 Taking ${snapshotType} snapshot...`);
    
    if (!videoRef.current || !canvasRef.current) {
      console.error('❌ Video or canvas not available');
      return;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.error('❌ Video not ready, dimensions:', video.videoWidth, 'x', video.videoHeight);
      return;
    }
    
    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('❌ No canvas context');
        return;
      }
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      console.log(`✅ Canvas set to: ${canvas.width}x${canvas.height}`);
      
      ctx.drawImage(video, 0, 0);
      console.log('✅ Video frame drawn to canvas');
      
      canvas.toBlob((blob) => {
        if (blob) {
          console.log(`✅ ${snapshotType} snapshot created! Size: ${blob.size} bytes`);
          
          const snapshot: Snapshot = {
            id: Date.now(),
            blob,
            timestamp: new Date().toLocaleTimeString()
          };
          
          setSnapshots(prev => {
            const updated = [...prev, snapshot];
            console.log(`✅ Snapshot added! Total snapshots: ${updated.length}`);
            return updated;
          });
        } else {
          console.error(`❌ Failed to create blob for ${snapshotType} snapshot`);
        }
      }, 'image/jpeg', 0.8);
      
    } catch (err) {
      console.error(`❌ Error taking ${snapshotType} snapshot:`, err);
    }
  };

  /**
   * Handles the final assessment submission process
   * Uploads audio and snapshot, updates candidate record, and triggers AI processing
   */
  const handleSubmitAssessment = async () => {
    if (!candidateData) {
      setError('Candidate data not found');
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

    if (assessmentExpired) {
      setError('Assessment time has expired. Cannot submit.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      console.log('Starting assessment submission...');
      
      // Upload recorded audio to Supabase Storage
      console.log('Uploading audio file...');
      const audioUrl = await storageService.uploadAudioFile(
        new File([audioBlob], `recording-${Date.now()}.webm`, { type: audioBlob.type }),
        true // Use service role for candidate submissions
      );
      console.log('Audio uploaded:', audioUrl);
      
      // Upload identity verification snapshot
      console.log('Uploading identity verification snapshot...');
      const snapshotUrl = await storageService.uploadImageFile(
        snapshots[0].blob,
        `snapshot-${Date.now()}.jpg`,
        true // Use service role for candidate submissions
      );
      console.log('Snapshot uploaded:', snapshotUrl);
      
      // Compile proctoring data for review
      const proctoringFlags = {
        tab_focus_lost: tabFocusLost,
        session_id: sessionId,
        recording_duration: recordingTime,
        snapshots_captured: snapshots.length,
        submission_timestamp: new Date().toISOString()
      };
      
      // Update candidate record with assessment data and mark as completed
      console.log('Updating candidate with assessment data...');
      const { error: updateError } = await supabase
        .from('candidates')
        .update({
          audio_source: audioUrl,
          snapshot_url: snapshotUrl,
          assessment_status: 'completed',
          proctoring_flags: proctoringFlags
        })
        .eq('id', candidateData.id);

      if (updateError) {
        throw new Error(`Failed to update candidate: ${updateError.message}`);
      }

      // Trigger AI assessment processing
      console.log('Triggering AI assessment processing...');
      await candidateSubmissionService.processExistingCandidate(candidateData.id, question.id);
      
      // Clean up timer data
      localStorage.removeItem(`assessmentStartTime_${sessionId}`);
      
      setSubmitted(true);
      
    } catch (err) {
      console.error('Error submitting assessment:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit assessment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Formats seconds into MM:SS format
   */
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Cleanup function to stop media streams and clear timers
   */
  const cleanup = () => {
    console.log('🧹 Starting cleanup...');
    
    if (mediaStream) {
      console.log('🧹 Stopping media stream tracks...');
      mediaStream.getTracks().forEach(track => track.stop());
    }
    
    if (timerRef.current) {
      console.log('🧹 Clearing timer...');
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    if (firstSnapshotTimerRef.current) {
      console.log('🧹 Clearing first snapshot timer...');
      clearTimeout(firstSnapshotTimerRef.current);
      firstSnapshotTimerRef.current = null;
    }
    
    if (secondSnapshotTimerRef.current) {
      console.log('🧹 Clearing second snapshot timer...');
      clearTimeout(secondSnapshotTimerRef.current);
      secondSnapshotTimerRef.current = null;
    }
    
    console.log('🧹 Cleanup completed');
  };

  // Loading state
  if (loadingCandidate || loadingQuestion) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading assessment...</p>
        </div>
      </div>
    );
  }

  // Assessment expired state
  if (assessmentExpired) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto h-16 w-16 flex items-center justify-center bg-red-100 rounded-full">
            <Timer className="h-8 w-8 text-red-600" />
          </div>
          
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Assessment Link Expired</h2>
            <p className="text-gray-600 mb-4">
              This assessment link has expired.
            </p>
            <p className="text-sm text-gray-500">
              Email ta@mediamint.com for a new link.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Success page
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto h-16 w-16 flex items-center justify-center bg-green-100 rounded-full">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Assessment Submitted</h2>
            <p className="text-gray-600 mb-4">
              Thank you, {candidateData?.name}! Your voice assessment has been submitted successfully.
            </p>
            <p className="text-sm text-gray-500">
              We system will evaluate your response and let you know the next steps. You may reach out to your recruiter for more details.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header with Timer */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Voice Assessment</h1>
          <p className="text-gray-600 mb-4">
            Welcome {candidateData?.name}! Complete your voice assessment by answering the question below. Please know that you have 3 minutes to complete the test, any cheating efforts will be flagged.
          </p>
          
          {/* Assessment Timer */}
          <div className={`inline-flex items-center space-x-2 px-4 py-2 rounded-lg font-mono text-lg font-bold ${
            timeRemaining <= 60 
              ? 'bg-red-100 text-red-800 border border-red-200' 
              : timeRemaining <= 120 
              ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
              : 'bg-blue-100 text-blue-800 border border-blue-200'
          }`}>
            <Timer className="h-5 w-5" />
            <span>Time Remaining: {formatTime(timeRemaining)}</span>
          </div>
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

        <div className="space-y-8">
          {/* Assessment Question */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Assessment Question</h2>
            
            {question ? (
              <div 
                ref={questionTextRef}
                className="bg-blue-50 p-4 rounded-lg select-none"
                style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none' }}
              >
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Video and Recording */}
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
                      disabled={!cameraReady || isRecording || !question || submitting || assessmentExpired}
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
            </div>

            {/* Right Column - Identity Verification and Submit */}
            <div className="space-y-6">
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

              {/* Proctoring Status */}
              {tabFocusLost && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                    <div>
                      <h3 className="font-medium text-red-800">Proctoring Alert</h3>
                      <p className="text-sm text-red-700">
                        Tab focus was lost during this session. This has been recorded for review.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button
                onClick={handleSubmitAssessment}
                disabled={!audioBlob || submitting || assessmentExpired}
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
    </div>
  );
}