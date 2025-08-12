import React, { useState, useRef, useEffect } from 'react';
import { Camera, Mic, Square, Play, Download } from 'lucide-react';
import { Button } from './UI/Button';

interface Snapshot {
  id: number;
  blob: Blob;
  timestamp: string;
}

export function BasicVideoRecorder() {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // State
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [error, setError] = useState<string>('');
  const [cameraReady, setCameraReady] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  // Timer ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const firstSnapshotTimerRef = useRef<NodeJS.Timeout | null>(null);
  const secondSnapshotTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    initializeCamera();
    return () => {
      cleanup();
    };
  }, []);

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
          console.log('Video metadata loaded');
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
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        setAudioChunks([]);
      };
      
      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError('Recording error occurred');
      };
      
      recorder.start(1000);
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
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
      }
      
      if (firstSnapshotTimerRef.current) {
        clearTimeout(firstSnapshotTimerRef.current);
      }
      
      if (secondSnapshotTimerRef.current) {
        clearTimeout(secondSnapshotTimerRef.current);
      }
    }
  };

  const scheduleSnapshots = () => {
    if (!isRecording) return;
    
    // First snapshot: 3-8 seconds after start
    const firstSnapshotDelay = Math.random() * 5000 + 3000; // 3-8 seconds
    
    firstSnapshotTimerRef.current = setTimeout(() => {
      takeSnapshot('first');
    }, firstSnapshotDelay);
    
    // Second snapshot: randomly between 30-90 seconds (within 2 minute window)
    const secondSnapshotDelay = Math.random() * 60000 + 30000; // 30-90 seconds
    
    secondSnapshotTimerRef.current = setTimeout(() => {
      takeSnapshot('second');
    }, secondSnapshotDelay);
  };

  const takeSnapshot = (snapshotType: 'first' | 'second') => {
    if (!videoRef.current || !canvasRef.current || !isRecording) return;
    
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return;
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
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
          
          setSnapshots(prev => [...prev, snapshot]);
          console.log(`${snapshotType} snapshot captured at:`, snapshot.timestamp);
        }
      }, 'image/jpeg', 0.8);
      
    } catch (err) {
      console.error('Error taking snapshot:', err);
    }
  };

  const downloadAudio = () => {
    if (!audioUrl) return;
    
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = `recording-${new Date().toISOString().slice(0, 19)}.webm`;
    link.click();
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
    
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Basic Video Recorder</h1>
          <p className="text-gray-600">Record audio with video display and automatic snapshots</p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="text-red-600 mr-2">⚠️</div>
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Video Section */}
          <div className="space-y-6">
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
                  style={{ maxHeight: '400px' }}
                />
                
                {!cameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75">
                    <div className="text-center text-white">
                      <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Initializing camera...</p>
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
                Audio Recording
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`} />
                    <span className="font-medium">
                      {isRecording ? 'Recording...' : 'Ready to record'}
                    </span>
                  </div>
                  
                  <div className="font-mono text-lg font-semibold">
                    {formatTime(recordingTime)}
                  </div>
                </div>
                
                <div className="flex space-x-3">
                  <Button
                    onClick={startRecording}
                    disabled={!cameraReady || isRecording}
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
              </div>
            </div>
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            {/* Audio Playback */}
            {audioUrl && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Recorded Audio</h2>
                
                <div className="space-y-4">
                  <audio controls className="w-full">
                    <source src={audioUrl} type="audio/webm" />
                    Your browser does not support the audio element.
                  </audio>
                  
                  <Button
                    onClick={downloadAudio}
                    variant="outline"
                    className="flex items-center space-x-2"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download Audio</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Snapshots */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Identity Verification
              </h2>
              
              <div className="text-center py-8">
                <div className="flex items-center justify-center space-x-2 mb-4">
                  <div className={`w-3 h-3 rounded-full ${snapshots.length >= 1 ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div className={`w-3 h-3 rounded-full ${snapshots.length >= 2 ? 'bg-green-500' : 'bg-gray-300'}`} />
                </div>
                <p className="text-sm text-gray-600">
                  {snapshots.length === 0 && 'Identity verification snapshots will be captured automatically during recording'}
                  {snapshots.length === 1 && 'First verification snapshot captured'}
                  {snapshots.length === 2 && 'All verification snapshots captured'}
                </p>
                {snapshots.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    {snapshots.length} snapshot{snapshots.length > 1 ? 's' : ''} ready for upload
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}