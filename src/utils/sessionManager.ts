interface SessionData {
  candidateId?: string;
  candidateName?: string;
  sessionId: string;
  startTime: number;
  lastActivity: number;
  questionId?: string;
  recordingStarted?: boolean;
  recordingCompleted?: boolean;
  snapshots?: number;
  sessionExpires: string;
  assessmentStatus: 'pending' | 'in_progress' | 'completed' | 'expired';
  proctoring: {
    tabFocusLost: boolean;
    windowBlurred: boolean;
    visibilityChanged: number;
    lastFocusLoss?: number;
  };
}

export class SessionManager {
  private readonly SESSION_KEY_PREFIX = 'voiceval_session_';
  private readonly ACTIVITY_HEARTBEAT_INTERVAL = 5000; // 5 seconds
  private readonly SESSION_WARNING_THRESHOLD = 30000; // 30 seconds before expiry
  
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private warningCallback: ((timeRemaining: number) => void) | null = null;
  private expiryCallback: (() => void) | null = null;

  /**
   * Initialize session management for a candidate assessment
   */
  initializeSession(sessionId: string, candidateData?: any): SessionData {
    const sessionKey = this.getSessionKey(sessionId);
    const now = Date.now();
    
    // Check for existing session
    const existingSession = this.getSession(sessionId);
    if (existingSession) {
      console.log('📱 Resuming existing session:', sessionId);
      // Update last activity
      existingSession.lastActivity = now;
      this.saveSession(existingSession);
      return existingSession;
    }

    console.log('🆕 Creating new session:', sessionId);
    
    // Create new session
    const sessionData: SessionData = {
      candidateId: candidateData?.id,
      candidateName: candidateData?.name,
      sessionId,
      startTime: now,
      lastActivity: now,
      sessionExpires: candidateData?.session_expires_at || new Date(now + 4 * 60 * 1000).toISOString(),
      assessmentStatus: candidateData?.assessment_status || 'pending',
      proctoring: {
        tabFocusLost: false,
        windowBlurred: false,
        visibilityChanged: 0
      }
    };

    this.saveSession(sessionData);
    this.startHeartbeat(sessionId);
    return sessionData;
  }

  /**
   * Get current session data
   */
  getSession(sessionId: string): SessionData | null {
    try {
      const sessionKey = this.getSessionKey(sessionId);
      const sessionJson = localStorage.getItem(sessionKey);
      if (!sessionJson) return null;

      const session = JSON.parse(sessionJson) as SessionData;
      
      // Check if session has expired
      if (new Date() > new Date(session.sessionExpires)) {
        console.warn('⏰ Session has expired:', sessionId);
        this.clearSession(sessionId);
        return null;
      }

      return session;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  /**
   * Update session data
   */
  updateSession(sessionId: string, updates: Partial<SessionData>): SessionData | null {
    const session = this.getSession(sessionId);
    if (!session) {
      console.warn('Cannot update non-existent session:', sessionId);
      return null;
    }

    const updatedSession = {
      ...session,
      ...updates,
      lastActivity: Date.now()
    };

    this.saveSession(updatedSession);
    return updatedSession;
  }

  /**
   * Update proctoring flags
   */
  updateProctoringFlags(sessionId: string, flags: Partial<SessionData['proctoring']>): void {
    const session = this.getSession(sessionId);
    if (!session) return;

    session.proctoring = {
      ...session.proctoring,
      ...flags
    };
    
    session.lastActivity = Date.now();
    this.saveSession(session);

    // Log proctoring events
    if (flags.tabFocusLost) {
      console.warn('🚨 Tab focus lost detected for session:', sessionId);
    }
    if (flags.windowBlurred) {
      console.warn('🚨 Window blur detected for session:', sessionId);
    }
  }

  /**
   * Record activity and reset inactivity timer
   */
  recordActivity(sessionId: string): void {
    const session = this.getSession(sessionId);
    if (!session) return;

    session.lastActivity = Date.now();
    this.saveSession(session);
  }

  /**
   * Get time remaining in session
   */
  getTimeRemaining(sessionId: string): number {
    const session = this.getSession(sessionId);
    if (!session) return 0;

    const expiryTime = new Date(session.sessionExpires).getTime();
    const now = Date.now();
    return Math.max(0, expiryTime - now);
  }

  /**
   * Check if session is about to expire
   */
  isSessionExpiringSoon(sessionId: string): boolean {
    return this.getTimeRemaining(sessionId) <= this.SESSION_WARNING_THRESHOLD;
  }

  /**
   * Check if session has expired
   */
  isSessionExpired(sessionId: string): boolean {
    return this.getTimeRemaining(sessionId) <= 0;
  }

  /**
   * Start heartbeat to monitor session activity
   */
  startHeartbeat(sessionId: string): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      const session = this.getSession(sessionId);
      if (!session) {
        this.stopHeartbeat();
        return;
      }

      const timeRemaining = this.getTimeRemaining(sessionId);
      
      // Check for expiry
      if (timeRemaining <= 0) {
        console.warn('⏰ Session expired:', sessionId);
        this.clearSession(sessionId);
        this.stopHeartbeat();
        if (this.expiryCallback) {
          this.expiryCallback();
        }
        return;
      }

      // Check for warning threshold
      if (timeRemaining <= this.SESSION_WARNING_THRESHOLD && this.warningCallback) {
        this.warningCallback(timeRemaining);
      }

      // Update activity timestamp
      this.recordActivity(sessionId);
      
    }, this.ACTIVITY_HEARTBEAT_INTERVAL);
  }

  /**
   * Stop heartbeat monitoring
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Set callbacks for session events
   */
  onSessionWarning(callback: (timeRemaining: number) => void): void {
    this.warningCallback = callback;
  }

  onSessionExpiry(callback: () => void): void {
    this.expiryCallback = callback;
  }

  /**
   * Clear session data
   */
  clearSession(sessionId: string): void {
    try {
      const sessionKey = this.getSessionKey(sessionId);
      localStorage.removeItem(sessionKey);
      
      // Also clear related assessment timer data
      const timerKey = `assessmentStartTime_${sessionId}`;
      localStorage.removeItem(timerKey);
      
      console.log('🗑️ Session cleared:', sessionId);
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  }

  /**
   * Get session statistics for debugging
   */
  getSessionStats(sessionId: string): any {
    const session = this.getSession(sessionId);
    if (!session) return null;

    const now = Date.now();
    const timeRemaining = this.getTimeRemaining(sessionId);
    
    return {
      sessionId: session.sessionId,
      candidateName: session.candidateName,
      duration: now - session.startTime,
      timeRemaining,
      isExpired: this.isSessionExpired(sessionId),
      isExpiringSoon: this.isSessionExpiringSoon(sessionId),
      lastActivity: new Date(session.lastActivity).toISOString(),
      assessmentStatus: session.assessmentStatus,
      proctoringFlags: session.proctoring,
      recordingState: {
        started: session.recordingStarted,
        completed: session.recordingCompleted,
        snapshots: session.snapshots || 0
      }
    };
  }

  /**
   * Extend session time (for admin purposes)
   */
  extendSession(sessionId: string, additionalMinutes: number): boolean {
    const session = this.getSession(sessionId);
    if (!session) return false;

    const currentExpiry = new Date(session.sessionExpires);
    const newExpiry = new Date(currentExpiry.getTime() + additionalMinutes * 60 * 1000);
    
    session.sessionExpires = newExpiry.toISOString();
    this.saveSession(session);
    
    console.log(`⏰ Session extended by ${additionalMinutes} minutes:`, sessionId);
    return true;
  }

  /**
   * Setup automatic proctoring event listeners
   */
  setupProctoringListeners(sessionId: string): () => void {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        this.updateProctoringFlags(sessionId, { 
          tabFocusLost: true,
          lastFocusLoss: Date.now()
        });
      }
      
      const session = this.getSession(sessionId);
      if (session) {
        session.proctoring.visibilityChanged++;
        this.saveSession(session);
      }
    };

    const handleWindowBlur = () => {
      this.updateProctoringFlags(sessionId, { 
        windowBlurred: true,
        lastFocusLoss: Date.now()
      });
    };

    const handleWindowFocus = () => {
      this.recordActivity(sessionId);
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const session = this.getSession(sessionId);
      if (session && session.recordingStarted && !session.recordingCompleted) {
        e.preventDefault();
        e.returnValue = 'You have an active recording. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Return cleanup function
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }

  /**
   * Get all active sessions (for debugging)
   */
  getAllActiveSessions(): SessionData[] {
    const sessions: SessionData[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.SESSION_KEY_PREFIX)) {
        try {
          const sessionJson = localStorage.getItem(key);
          if (sessionJson) {
            const session = JSON.parse(sessionJson) as SessionData;
            if (!this.isSessionExpired(session.sessionId)) {
              sessions.push(session);
            }
          }
        } catch (error) {
          console.error('Error parsing session:', key, error);
        }
      }
    }
    
    return sessions;
  }

  /**
   * Cleanup expired sessions
   */
  cleanupExpiredSessions(): number {
    let cleaned = 0;
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.SESSION_KEY_PREFIX)) {
        try {
          const sessionJson = localStorage.getItem(key);
          if (sessionJson) {
            const session = JSON.parse(sessionJson) as SessionData;
            if (this.isSessionExpired(session.sessionId)) {
              localStorage.removeItem(key);
              cleaned++;
            }
          }
        } catch (error) {
          // Remove corrupted sessions
          localStorage.removeItem(key);
          cleaned++;
        }
      }
    }
    
    if (cleaned > 0) {
      console.log(`🗑️ Cleaned up ${cleaned} expired sessions`);
    }
    
    return cleaned;
  }

  private getSessionKey(sessionId: string): string {
    return `${this.SESSION_KEY_PREFIX}${sessionId}`;
  }

  private saveSession(session: SessionData): void {
    try {
      const sessionKey = this.getSessionKey(session.sessionId);
      localStorage.setItem(sessionKey, JSON.stringify(session));
    } catch (error) {
      console.error('Error saving session:', error);
    }
  }
}

export const sessionManager = new SessionManager();

// Auto-cleanup expired sessions periodically
if (typeof window !== 'undefined') {
  // Cleanup on load
  sessionManager.cleanupExpiredSessions();
  
  // Periodic cleanup every 5 minutes
  setInterval(() => {
    sessionManager.cleanupExpiredSessions();
  }, 5 * 60 * 1000);
}
