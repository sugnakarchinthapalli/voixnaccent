import React from 'react'

const ControlsSection = ({ 
  isRecording, 
  recordingStatus, 
  elapsedTime, 
  maxDuration,
  onStartRecording, 
  onStopRecording 
}) => {
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const maxDurationSeconds = Math.floor(maxDuration / 1000)

  return (
    <section className="controls-section">
      <div className="recording-info">
        <div className="status-indicator">
          <span className="status-text">{recordingStatus}</span>
          <div className={`recording-dot ${isRecording ? 'active' : ''}`}></div>
        </div>
        <div className="timer-display">
          <span>{formatTime(elapsedTime)} / {formatTime(maxDurationSeconds)}</span>
        </div>
      </div>

      <div className="control-buttons">
        <button 
          className="btn btn-primary"
          onClick={onStartRecording}
          disabled={isRecording}
        >
          <span className="btn-icon">🎤</span>
          Start Recording
        </button>
        <button 
          className="btn btn-secondary"
          onClick={onStopRecording}
          disabled={!isRecording}
        >
          <span className="btn-icon">⏹</span>
          Stop Recording
        </button>
      </div>
    </section>
  )
}

export default ControlsSection