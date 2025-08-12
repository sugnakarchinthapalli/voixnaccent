import { useState, useRef, useEffect, useCallback } from 'react'

export const useWebcamRecorder = () => {
  // Refs
  const videoRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const canvasRef = useRef(null)
  const canvasContextRef = useRef(null)
  const recordingTimerRef = useRef(null)
  const snapshotTimerRef = useRef(null)
  const recordingStartTimeRef = useRef(null)

  // State
  const [isVideoReady, setIsVideoReady] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingStatus, setRecordingStatus] = useState('Ready to Record')
  const [elapsedTime, setElapsedTime] = useState(0)
  const [snapshots, setSnapshots] = useState([])
  const [audioChunks, setAudioChunks] = useState([])
  const [audioBlob, setAudioBlob] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [error, setError] = useState(null)

  // Constants
  const maxDuration = 120000 // 2 minutes in milliseconds

  // Initialize canvas
  useEffect(() => {
    canvasRef.current = document.createElement('canvas')
    canvasContextRef.current = canvasRef.current.getContext('2d')
  }, [])

  // Setup camera on mount
  useEffect(() => {
    setupCamera()
    
    // Cleanup on unmount
    return () => {
      cleanup()
    }
  }, [])

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isRecording) {
        setError('Recording paused - tab is not visible')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isRecording])

  // Handle beforeunload for active recordings
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isRecording) {
        e.preventDefault()
        e.returnValue = 'You have an active recording. Are you sure you want to leave?'
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isRecording])

  const setupCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia is not supported in this browser')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      })

      mediaStreamRef.current = stream
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setIsVideoReady(true)
        setRecordingStatus('Ready to Record')
      }

    } catch (err) {
      handleCameraError(err)
    }
  }

  const handleCameraError = (error) => {
    let message = 'Failed to access camera and microphone: '
    
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      message += 'Permission denied. Please allow camera and microphone access and reload the page.'
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      message += 'No camera or microphone found.'
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      message += 'Camera or microphone is already in use by another application.'
    } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
      message += 'Camera constraints could not be satisfied.'
    } else {
      message += error.message || 'Unknown error occurred.'
    }

    setError(message)
    setRecordingStatus('Error - Check permissions')
  }

  const getSupportedMimeType = () => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus'
    ]

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type
      }
    }

    return 'audio/webm' // fallback
  }

  const startRecording = async () => {
    if (!mediaStreamRef.current) {
      setError('Camera not available. Please reload the page and grant permissions.')
      return
    }

    try {
      const audioTracks = mediaStreamRef.current.getAudioTracks()
      const audioStream = new MediaStream(audioTracks)
      
      const mediaRecorder = new MediaRecorder(audioStream, {
        mimeType: getSupportedMimeType()
      })

      const chunks = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: getSupportedMimeType() })
        const url = URL.createObjectURL(blob)
        const duration = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000)
        
        setAudioBlob(blob)
        setAudioUrl(url)
        setRecordingDuration(duration)
        setAudioChunks([])
      }

      mediaRecorderRef.current = mediaRecorder
      setAudioChunks(chunks)

      mediaRecorder.start(1000)
      setIsRecording(true)
      recordingStartTimeRef.current = Date.now()
      setRecordingStatus('Recording...')

      startRecordingTimer()
      scheduleNextSnapshot()

      // Auto-stop after max duration
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          stopRecording()
        }
      }, maxDuration)

    } catch (err) {
      setError(`Failed to start recording: ${err.message}`)
    }
  }

  const stopRecording = useCallback(() => {
    if (!isRecording) return

    setIsRecording(false)

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
    }

    if (snapshotTimerRef.current) {
      clearTimeout(snapshotTimerRef.current)
    }

    setRecordingStatus('Recording Complete')
  }, [isRecording])

  const startRecordingTimer = () => {
    recordingTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - recordingStartTimeRef.current
      const elapsedSeconds = Math.floor(elapsed / 1000)
      
      setElapsedTime(elapsedSeconds)

      if (elapsed >= maxDuration) {
        stopRecording()
      }
    }, 1000)
  }

  const scheduleNextSnapshot = () => {
    if (!isRecording) return

    const randomInterval = 5000 + Math.random() * 10000 // 5-15 seconds
    
    snapshotTimerRef.current = setTimeout(() => {
      takeSnapshot()
      scheduleNextSnapshot()
    }, randomInterval)
  }

  const takeSnapshot = () => {
    if (!isRecording || !videoRef.current || !videoRef.current.videoWidth) return

    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      const context = canvasContextRef.current

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      context.drawImage(video, 0, 0)

      canvas.toBlob((blob) => {
        const timestamp = new Date().toISOString()
        const snapshot = {
          id: Date.now(),
          blob,
          timestamp,
          url: URL.createObjectURL(blob)
        }

        setSnapshots(prev => [...prev, snapshot])
      }, 'image/png')

    } catch (err) {
      console.error('Failed to take snapshot:', err)
    }
  }

  const downloadSnapshot = (id) => {
    const snapshot = snapshots.find(s => s.id === id)
    if (!snapshot) return

    const link = document.createElement('a')
    link.href = snapshot.url
    link.download = `snapshot_${snapshot.timestamp.replace(/[:.]/g, '-')}.png`
    link.click()
  }

  const downloadAllSnapshots = () => {
    snapshots.forEach((snapshot, index) => {
      setTimeout(() => {
        const link = document.createElement('a')
        link.href = snapshot.url
        link.download = `snapshot_${index + 1}_${snapshot.timestamp.replace(/[:.]/g, '-')}.png`
        link.click()
      }, index * 500)
    })
  }

  const clearSnapshots = () => {
    snapshots.forEach(snapshot => {
      URL.revokeObjectURL(snapshot.url)
    })
    setSnapshots([])
  }

  const dismissError = () => {
    setError(null)
  }

  const cleanup = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
    }

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
    }

    if (snapshotTimerRef.current) {
      clearTimeout(snapshotTimerRef.current)
    }

    snapshots.forEach(snapshot => {
      URL.revokeObjectURL(snapshot.url)
    })

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
    }
  }

  return {
    // Refs
    videoRef,
    
    // State
    mediaStream: mediaStreamRef.current,
    isVideoReady,
    isRecording,
    recordingStatus,
    elapsedTime,
    maxDuration,
    snapshots,
    audioBlob,
    audioUrl,
    recordingDuration,
    error,
    
    // Actions
    startRecording,
    stopRecording,
    dismissError,
    downloadSnapshot,
    downloadAllSnapshots,
    clearSnapshots
  }
}