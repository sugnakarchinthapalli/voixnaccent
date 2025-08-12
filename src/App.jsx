import React from 'react'
import Header from './components/Header'
import ErrorMessage from './components/ErrorMessage'
import VideoSection from './components/VideoSection'
import ControlsSection from './components/ControlsSection'
import SnapshotsSection from './components/SnapshotsSection'
import DownloadsSection from './components/DownloadsSection'
import Footer from './components/Footer'
import { useWebcamRecorder } from './hooks/useWebcamRecorder'

function App() {
  const {
    // Video and media state
    videoRef,
    mediaStream,
    isVideoReady,
    
    // Recording state
    isRecording,
    recordingStatus,
    elapsedTime,
    maxDuration,
    
    // Snapshots state
    snapshots,
    
    // Audio state
    audioBlob,
    audioUrl,
    recordingDuration,
    
    // Error state
    error,
    
    // Actions
    startRecording,
    stopRecording,
    dismissError,
    downloadSnapshot,
    downloadAllSnapshots,
    clearSnapshots
  } = useWebcamRecorder()

  return (
    <div className="app">
      <Header />
      
      <main>
        {error && (
          <ErrorMessage 
            message={error} 
            onDismiss={dismissError} 
          />
        )}
        
        <VideoSection 
          videoRef={videoRef}
          isVideoReady={isVideoReady}
        />
        
        <ControlsSection
          isRecording={isRecording}
          recordingStatus={recordingStatus}
          elapsedTime={elapsedTime}
          maxDuration={maxDuration}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
        />
        
        <SnapshotsSection
          snapshots={snapshots}
          onDownloadSnapshot={downloadSnapshot}
          onDownloadAll={downloadAllSnapshots}
          onClearAll={clearSnapshots}
        />
        
        {audioBlob && (
          <DownloadsSection
            audioUrl={audioUrl}
            audioBlob={audioBlob}
            recordingDuration={recordingDuration}
          />
        )}
      </main>
      
      <Footer />
    </div>
  )
}

export default App