import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Camera, 
  Mic, 
  CheckCircle, 
  AlertCircle, 
  Play, 
  Square, 
  VolumeX, 
  Volume2,
  Monitor,
  Wifi,
  Timer,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { Button } from '../UI/Button';
import { supabaseServiceRole } from '../../lib/supabaseServiceRole';
import { Candidate } from '../../types';

interface SystemCheckResult {
  camera: boolean;
  microphone: boolean;
  speaker: boolean;
  connection: boolean;
}

export function SystemCheckPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // State
  const [candidateData, setCandidateData] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  
  // System check states
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [systemCheck, setSystemCheck] = useState<SystemCheckResult>({
    camera: false,
    microphone: false,
    speaker: false,
    connection: false
  });
  const [isTestingAudio, setIsTestingAudio] = useState(false);
  const [testRecording, setTestRecording] = useState<Blob | null>(null);
  const [isRecordingTest, setIsRecordingTest] = useState(false);
  const [testMediaRecorder, setTestMediaRecorder] = useState<MediaRecorder | null>(null);
  
  // UI states
  const [currentStep, setCurrentStep] = useState<'loading' | 'instructions' | 'system-check' | 'assessment' | 'submitted'>('loading');
  const [acknowledged, setAcknowledged] = useState(false);
  
  // Assessment states - moved from CandidateAssessmentPage
  const [question, setQuestion] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(180); // 3 minutes
  const [assessmentExpired, setAssessmentExpired] = useState(false);
  const [tabFocusLost, setTabFocusLost] = useState(false);
  
  // Media recording states
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [timerRef, setTimerRef] = useState(null);
  
  // Constants
  const MAX_RECORDING_TIME = 120; // 2 minutes
  const ASSESSMENT_DURATION = 180; // 3 minutes

  useEffect(() => {
    if (!sessionId) {
      setError('Invalid assessment link. Please contact your administrator.');
      return;
    }

    initializeCandidate();
  }, [sessionId]);

  /**
   * Initialize candidate data and validate session
   */
  const initializeCandidate = async () => {
    try {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      
      if (!sessionId || !uuidRegex.test(sessionId)) {
        setError('Invalid assessment link format. Please contact your administrator.');
        setLoading(false);
        return;
      }
      
      // Use the internal client directly to avoid custom wrapper issues
      const result = await supabaseServiceRole.from('candidates').select('*').eq('assessment_link_id', sessionId);
      const { data: candidates, error: candidateError } = result;

      if (candidateError) {
        setError('Database error occurred. Please contact your administrator.');
        setLoading(false);
        return;
      }

      if (!candidates || candidates.length === 0) {
        setError('Invalid assessment link or assessment not found. Please contact your administrator.');
        setLoading(false);
        return;
      }

      const candidate = candidates[0];
      setCandidateData(candidate);

      // Check if assessment is already completed or expired
      if (candidate.assessment_status === 'completed') {
        setError('This assessment has already been submitted.');
        setLoading(false);
        return;
      }

      if (candidate.assessment_status === 'expired') {
        setError('Assessment link expired. Email ta@mediamint.com for a new link.');
        setLoading(false);
        return;
      }

      // Check system connection
      await checkConnection();
      
      setLoading(false);
      setCurrentStep('instructions');
      
    } catch (err) {
      console.error('Error initializing candidate:', err);
      setError('Failed to initialize assessment. Please try again.');
      setLoading(false);
    }
  };

  /**
   * Check internet connection
   */
  const checkConnection = async () => {
    try {
      // Simple connection test - try to fetch from a reliable endpoint
      const response = await fetch('https://www.google.com/favicon.ico', { 
        mode: 'no-cors',
        cache: 'no-cache'
      });
      setSystemCheck(prev => ({ ...prev, connection: true }));
    } catch (error) {
      console.warn('Connection test failed:', error);
      setSystemCheck(prev => ({ ...prev, connection: false }));
    }
  };

  /**
   * Test camera and microphone access
   */
  const testCameraAndMicrophone = async () => {
    try {
      setError('');
      
      // Request camera and microphone permissions
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

      setMediaStream(stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Check if we have video and audio tracks
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();

      setSystemCheck(prev => ({
        ...prev,
        camera: videoTracks.length > 0 && videoTracks[0].readyState === 'live',
        microphone: audioTracks.length > 0 && audioTracks[0].readyState === 'live'
      }));

      console.log('✅ Camera and microphone access granted');
      
    } catch (err) {
      console.error('❌ Error accessing camera/microphone:', err);
      setError(`Unable to access camera and microphone: ${err instanceof Error ? err.message : 'Unknown error'}. Please ensure you've granted permissions and try again.`);
      
      setSystemCheck(prev => ({
        ...prev,
        camera: false,
        microphone: false
      }));
    }
  };

  /**
   * Test audio recording and playback
   */
  const testAudioRecording = async () => {
    if (!mediaStream) return;

    try {
      setIsRecordingTest(true);
      setError('');

      const audioTracks = mediaStream.getAudioTracks();
      const audioStream = new MediaStream(audioTracks);
      
      const recorder = new MediaRecorder(audioStream, {
        mimeType: 'audio/webm'
      });
      
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setTestRecording(blob);
        setIsRecordingTest(false);
        console.log('✅ Test recording completed');
      };
      
      recorder.onerror = (event) => {
        console.error('❌ Recording error:', event);
        setError('Recording test failed. Please try again.');
        setIsRecordingTest(false);
      };
      
      setTestMediaRecorder(recorder);
      recorder.start();
      
      // Stop recording after 3 seconds
      setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, 3000);
      
    } catch (err) {
      console.error('❌ Error testing audio recording:', err);
      setError('Audio recording test failed. Please try again.');
      setIsRecordingTest(false);
    }
  };

  /**
   * Test audio playback
   */
  const testAudioPlayback = async () => {
    if (!testRecording) return;

    try {
      setIsTestingAudio(true);
      
      if (audioRef.current) {
        audioRef.current.src = URL.createObjectURL(testRecording);
        await audioRef.current.play();
        
        audioRef.current.onended = () => {
          setIsTestingAudio(false);
          setSystemCheck(prev => ({ ...prev, speaker: true }));
          console.log('✅ Audio playback test completed');
        };
        
        audioRef.current.onerror = () => {
          setIsTestingAudio(false);
          setError('Audio playback test failed. Please check your speakers.');
          console.error('❌ Audio playback failed');
        };
      }
    } catch (err) {
      console.error('❌ Error testing audio playback:', err);
      setError('Audio playback test failed. Please check your speakers.');
      setIsTestingAudio(false);
    }
  };

  /**
   * Proceed to actual assessment
   */
  const proceedToAssessment = async () => {
    try {
      // Load assessment question
      console.log('Loading assessment question...');
      // For now, set a dummy question - we'll implement question loading later
      setQuestion({
        id: 1,
        text: "Tell me about a challenging project you worked on recently and how you overcame the obstacles you faced."
      });
      
      // Start assessment timer
      const startTime = Date.now();
      localStorage.setItem(`assessmentStartTime_${sessionId}`, startTime.toString());
      
      const updateTimer = () => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.max(0, ASSESSMENT_DURATION - elapsed);
        setTimeRemaining(remaining);
        
        if (remaining <= 0) {
          setAssessmentExpired(true);
          return;
        }
        
        setTimeout(updateTimer, 1000);
      };
      updateTimer();
      
      // Keep the existing media stream for recording
      // Don't clean it up since we'll use it for assessment
      
      // Transition to assessment step
      setCurrentStep('assessment');
      
    } catch (error) {
      console.error('Error starting assessment:', error);
      setError('Failed to start assessment. Please try again.');
    }
  };

  /**
   * Restart system check
   */
  const restartSystemCheck = () => {
    // Clean up existing stream
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      setMediaStream(null);
    }
    
    // Reset states
    setSystemCheck({
      camera: false,
      microphone: false,
      speaker: false,
      connection: false
    });
    setTestRecording(null);
    setError('');
    
    // Restart connection check
    checkConnection();
  };

  const allSystemsReady = systemCheck.camera && systemCheck.microphone && systemCheck.speaker && systemCheck.connection;

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading system check...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && currentStep === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto h-16 w-16 flex items-center justify-center bg-red-100 rounded-full">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Assessment Error</h2>
            <p className="text-gray-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Voice Assessment - System Check</h1>
          <p className="text-gray-600">
            Welcome {candidateData?.name}! Let's make sure your system is ready for the assessment.
          </p>
        </div>

        {/* Instructions Step */}
        {currentStep === 'instructions' && (
          <div className="bg-white rounded-lg shadow-sm border p-8 mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Before We Begin</h2>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Timer className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Time Limit</h3>
                    <p className="text-sm text-gray-600">You have 3 minutes total for the assessment, with a maximum of 2 minutes to record your answer.</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                    <Camera className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Identity Verification</h3>
                    <p className="text-sm text-gray-600">Your camera will capture verification snapshots during recording for security purposes.</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
                    <Monitor className="h-4 w-4 text-yellow-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Stay Focused</h3>
                    <p className="text-sm text-gray-600">Please don't switch tabs or minimize the window. Any focus changes will be recorded.</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <Mic className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Clear Audio</h3>
                    <p className="text-sm text-gray-600">Speak clearly into your microphone. Make sure you're in a quiet environment.</p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">What to Expect:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• You'll be asked one assessment question</li>
                  <li>• Take a moment to think before recording</li>
                  <li>• You can review your recording before submitting</li>
                  <li>• Once submitted, you cannot retake the assessment</li>
                </ul>
              </div>

              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="acknowledge"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="acknowledge" className="text-sm text-gray-700">
                  I understand the assessment requirements and agree to proceed with system verification.
                </label>
              </div>
            </div>

            <div className="flex justify-center mt-8">
              <Button
                onClick={() => setCurrentStep('system-check')}
                disabled={!acknowledged}
                className="flex items-center space-x-2"
                size="lg"
              >
                <span>Continue to System Check</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* System Check Step */}
        {currentStep === 'system-check' && (
          <div className="space-y-6">
            {/* System Requirements Check */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">System Requirements</h2>
                <Button
                  onClick={restartSystemCheck}
                  variant="outline"
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Restart Check</span>
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Connection Test */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Wifi className="h-5 w-5 text-gray-500" />
                    <span className="font-medium">Internet Connection</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {systemCheck.connection ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    )}
                    <span className={`text-sm font-medium ${systemCheck.connection ? 'text-green-600' : 'text-red-600'}`}>
                      {systemCheck.connection ? 'Connected' : 'Check Connection'}
                    </span>
                  </div>
                </div>

                {/* Camera Test */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Camera className="h-5 w-5 text-gray-500" />
                    <span className="font-medium">Camera Access</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {systemCheck.camera ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    )}
                    <span className={`text-sm font-medium ${systemCheck.camera ? 'text-green-600' : 'text-red-600'}`}>
                      {systemCheck.camera ? 'Working' : 'Test Required'}
                    </span>
                  </div>
                </div>

                {/* Microphone Test */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Mic className="h-5 w-5 text-gray-500" />
                    <span className="font-medium">Microphone Access</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {systemCheck.microphone ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    )}
                    <span className={`text-sm font-medium ${systemCheck.microphone ? 'text-green-600' : 'text-red-600'}`}>
                      {systemCheck.microphone ? 'Working' : 'Test Required'}
                    </span>
                  </div>
                </div>

                {/* Speaker Test */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Volume2 className="h-5 w-5 text-gray-500" />
                    <span className="font-medium">Speaker/Headphones</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {systemCheck.speaker ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    )}
                    <span className={`text-sm font-medium ${systemCheck.speaker ? 'text-green-600' : 'text-red-600'}`}>
                      {systemCheck.speaker ? 'Working' : 'Test Required'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Camera and Microphone Test */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Video Preview */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Camera Test</h3>
                
                <div className="relative bg-gray-900 rounded-lg overflow-hidden mb-4">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-auto"
                    style={{ maxHeight: '250px' }}
                  />
                  
                  {!mediaStream && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75">
                      <div className="text-center text-white">
                        <Camera className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Click "Test Camera & Mic" to begin</p>
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  onClick={testCameraAndMicrophone}
                  disabled={mediaStream !== null}
                  className="w-full flex items-center justify-center space-x-2"
                >
                  <Camera className="h-4 w-4" />
                  <span>{mediaStream ? 'Camera & Mic Ready' : 'Test Camera & Microphone'}</span>
                </Button>
              </div>

              {/* Audio Test */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Audio Test</h3>
                
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">1. Record Test Audio</span>
                      {testRecording && <CheckCircle className="h-4 w-4 text-green-500" />}
                    </div>
                    <Button
                      onClick={testAudioRecording}
                      disabled={!mediaStream || isRecordingTest || testRecording !== null}
                      size="sm"
                      className="w-full"
                    >
                      {isRecordingTest ? (
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                          <span>Recording... (3s)</span>
                        </div>
                      ) : testRecording ? (
                        'Recording Complete'
                      ) : (
                        'Start 3-Second Test Recording'
                      )}
                    </Button>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">2. Test Playback</span>
                      {systemCheck.speaker && <CheckCircle className="h-4 w-4 text-green-500" />}
                    </div>
                    <Button
                      onClick={testAudioPlayback}
                      disabled={!testRecording || isTestingAudio}
                      size="sm"
                      className="w-full"
                    >
                      {isTestingAudio ? (
                        <div className="flex items-center space-x-2">
                          <Volume2 className="h-4 w-4" />
                          <span>Playing Test Audio...</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <Play className="h-4 w-4" />
                          <span>Play Test Recording</span>
                        </div>
                      )}
                    </Button>
                  </div>

                  <audio ref={audioRef} className="hidden" />
                </div>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                  <p className="text-red-800">{error}</p>
                </div>
              </div>
            )}

            {/* Proceed Button */}
            <div className="text-center">
              {allSystemsReady ? (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-center space-x-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-800">All systems ready! You can now proceed to the assessment.</span>
                    </div>
                  </div>
                  
                  <Button
                    onClick={proceedToAssessment}
                    size="lg"
                    className="flex items-center space-x-2"
                  >
                    <span>Start Assessment</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center justify-center space-x-2">
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                    <span className="font-medium text-yellow-800">
                      Please complete all system checks above before proceeding.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Assessment Step */}
        {currentStep === 'assessment' && (
          <div className="space-y-8">
            {/* Timer Header */}
            <div className="text-center">
              <div className={`inline-flex items-center space-x-2 px-4 py-2 rounded-lg font-mono text-lg font-bold ${
                timeRemaining <= 60 
                  ? 'bg-red-100 text-red-800 border border-red-200' 
                  : timeRemaining <= 120 
                  ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                  : 'bg-blue-100 text-blue-800 border border-blue-200'
              }`}>
                <Timer className="h-5 w-5" />
                <span>Time Remaining: {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}</span>
              </div>
            </div>

            {/* Assessment Question */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Assessment Question</h2>
              
              {question && (
                <div className="bg-blue-50 p-4 rounded-lg select-none">
                  <p className="text-gray-700 leading-relaxed">{question.text}</p>
                  <div className="mt-3 flex items-center text-xs text-blue-600">
                    <Timer className="h-3 w-3 mr-1" />
                    <span>Maximum 2 minutes to answer</span>
                  </div>
                </div>
              )}
            </div>

            {/* Recording Interface */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                </div>
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
                      {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')} / {Math.floor(MAX_RECORDING_TIME / 60)}:{(MAX_RECORDING_TIME % 60).toString().padStart(2, '0')}
                    </div>
                  </div>
                  
                  <div className="flex space-x-3">
                    <Button
                      onClick={() => console.log('Start recording')}
                      disabled={isRecording || assessmentExpired}
                      className="flex items-center space-x-2"
                    >
                      <Mic className="h-4 w-4" />
                      <span>Start Recording</span>
                    </Button>
                    
                    <Button
                      onClick={() => console.log('Stop recording')}
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

            {/* Submit Button */}
            <div className="text-center">
              <Button
                onClick={() => setCurrentStep('submitted')}
                disabled={!audioBlob || submitting || assessmentExpired}
                loading={submitting}
                className="flex items-center space-x-2"
                size="lg"
              >
                <span>{submitting ? 'Submitting Assessment...' : 'Submit Assessment'}</span>
              </Button>
            </div>
          </div>
        )}

        {/* Submitted Step */}
        {currentStep === 'submitted' && (
          <div className="text-center space-y-6">
            <div className="mx-auto h-16 w-16 flex items-center justify-center bg-green-100 rounded-full">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Assessment Submitted</h2>
              <p className="text-gray-600 mb-4">
                Thank you, {candidateData?.name}! Your voice assessment has been submitted successfully.
              </p>
              <p className="text-sm text-gray-500">
                We will evaluate your response and let you know the next steps. You may reach out to your recruiter for more details.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
