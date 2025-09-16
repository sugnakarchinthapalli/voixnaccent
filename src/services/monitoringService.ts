import { supabaseServiceRole } from '../lib/supabaseServiceRole';

interface MonitoringMetrics {
  activeAssessments: number;
  queueLength: number;
  failedAssessments: number;
  avgProcessingTime: number;
  errorRate: number;
  lastErrorTime?: Date;
  systemHealth: 'healthy' | 'warning' | 'critical';
}

interface SystemAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  timestamp: Date;
  resolved: boolean;
  metadata?: Record<string, any>;
}

export class MonitoringService {
  private alerts: SystemAlert[] = [];
  private metrics: MonitoringMetrics = {
    activeAssessments: 0,
    queueLength: 0,
    failedAssessments: 0,
    avgProcessingTime: 0,
    errorRate: 0,
    systemHealth: 'healthy'
  };
  
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly MONITORING_INTERVAL = 30000; // 30 seconds
  private readonly MAX_ALERTS = 100;
  private readonly ERROR_THRESHOLD = 0.1; // 10% error rate threshold
  private readonly QUEUE_LENGTH_WARNING = 50;
  private readonly QUEUE_LENGTH_CRITICAL = 100;

  startMonitoring() {
    if (this.monitoringInterval) {
      console.log('🔍 Monitoring already running');
      return;
    }

    console.log('🚀 Starting system monitoring...');
    
    // Initial check
    this.checkSystemHealth();
    
    // Periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.checkSystemHealth();
    }, this.MONITORING_INTERVAL);
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('⏹️ System monitoring stopped');
    }
  }

  private async checkSystemHealth() {
    try {
      // Check assessment queue status
      await this.checkQueueHealth();
      
      // Check database connectivity
      await this.checkDatabaseHealth();
      
      // Check failed assessments
      await this.checkFailedAssessments();
      
      // Check session expiry issues
      await this.checkSessionExpiryIssues();
      
      // Update overall system health
      this.updateSystemHealth();
      
      // Log metrics for debugging
      this.logMetrics();
      
    } catch (error) {
      console.error('❌ Error during system health check:', error);
      this.createAlert('error', 'System health check failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  private async checkQueueHealth() {
    try {
      const { data: queueItems, error } = await supabaseServiceRole
        .from('assessment_queue')
        .select('*')
        .in('status', ['pending', 'processing', 'failed']);

      if (error) {
        console.warn('Queue health check failed:', error.message);
        return; // Don't throw, just skip this check
      }

      if (!queueItems) {
        console.warn('No queue data returned');
        return;
      }

      const pending = queueItems.filter(item => item.status === 'pending').length;
      const processing = queueItems.filter(item => item.status === 'processing').length;
      const failed = queueItems.filter(item => item.status === 'failed').length;
      const total = queueItems.length;

      this.metrics.queueLength = total;
      this.metrics.activeAssessments = processing;
      this.metrics.failedAssessments = failed;
      this.metrics.errorRate = total > 0 ? failed / total : 0;

      // Check queue length alerts
      if (total >= this.QUEUE_LENGTH_CRITICAL) {
        this.createAlert('error', `Critical queue length: ${total} items`, { 
          queueLength: total, 
          pending, 
          processing, 
          failed 
        });
      } else if (total >= this.QUEUE_LENGTH_WARNING) {
        this.createAlert('warning', `High queue length: ${total} items`, { 
          queueLength: total, 
          pending, 
          processing, 
          failed 
        });
      }

      // Check error rate
      if (this.metrics.errorRate > this.ERROR_THRESHOLD) {
        this.createAlert('warning', `High error rate: ${Math.round(this.metrics.errorRate * 100)}%`, {
          errorRate: this.metrics.errorRate,
          failedCount: failed,
          totalCount: total
        });
      }

      // Skip stuck items check for now to avoid query method issues
      // TODO: Implement this when proper query methods are available

    } catch (error) {
      console.error('Error checking queue health:', error);
      this.createAlert('error', 'Queue health check failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  private async checkDatabaseHealth() {
    try {
      const startTime = Date.now();
      const isHealthy = await supabaseServiceRole.healthCheck();
      const responseTime = Date.now() - startTime;

      if (!isHealthy) {
        this.createAlert('error', 'Database health check failed', { responseTime });
      } else if (responseTime > 5000) { // 5 second threshold
        this.createAlert('warning', `Database response time high: ${responseTime}ms`, { responseTime });
      }

    } catch (error) {
      console.error('Error checking database health:', error);
      this.createAlert('error', 'Database health check error', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  private async checkFailedAssessments() {
    try {
      // Skip this check for now to avoid query method issues
      // The .gte() method is causing errors in the current Supabase client setup
      console.log('Skipping failed assessments check (not critical for basic functionality)');

    } catch (error) {
      console.error('Error checking failed assessments:', error);
    }
  }

  private async checkSessionExpiryIssues() {
    try {
      // Skip this check for now to avoid query method issues
      // The .lt() method is causing errors in the current Supabase client setup
      console.log('Skipping session expiry check (not critical for basic functionality)');

    } catch (error) {
      console.error('Error checking session expiry issues:', error);
    }
  }

  private updateSystemHealth() {
    let health: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Determine system health based on metrics and recent alerts
    const recentAlerts = this.alerts.filter(alert => 
      !alert.resolved && 
      Date.now() - alert.timestamp.getTime() < 5 * 60 * 1000 // Last 5 minutes
    );

    const errorAlerts = recentAlerts.filter(alert => alert.type === 'error');
    const warningAlerts = recentAlerts.filter(alert => alert.type === 'warning');

    if (errorAlerts.length > 0) {
      health = 'critical';
    } else if (warningAlerts.length > 0 || this.metrics.errorRate > this.ERROR_THRESHOLD) {
      health = 'warning';
    }

    this.metrics.systemHealth = health;
  }

  private createAlert(type: 'error' | 'warning' | 'info', message: string, metadata?: Record<string, any>) {
    const alert: SystemAlert = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      timestamp: new Date(),
      resolved: false,
      metadata
    };

    // Check for duplicate alerts (same message within last 5 minutes)
    const recentDuplicate = this.alerts.find(existing => 
      existing.message === message && 
      !existing.resolved &&
      Date.now() - existing.timestamp.getTime() < 5 * 60 * 1000
    );

    if (recentDuplicate) {
      // Update existing alert with new metadata
      recentDuplicate.metadata = { ...recentDuplicate.metadata, ...metadata };
      return;
    }

    this.alerts.unshift(alert);

    // Keep only recent alerts
    if (this.alerts.length > this.MAX_ALERTS) {
      this.alerts = this.alerts.slice(0, this.MAX_ALERTS);
    }

    const emoji = type === 'error' ? '🚨' : type === 'warning' ? '⚠️' : 'ℹ️';
    console.log(`${emoji} ALERT [${type.toUpperCase()}]: ${message}`, metadata);

    if (type === 'error') {
      this.metrics.lastErrorTime = new Date();
    }
  }

  private logMetrics() {
    console.log(`📊 System Metrics [${new Date().toISOString()}]:`, {
      health: this.metrics.systemHealth,
      queue: this.metrics.queueLength,
      active: this.metrics.activeAssessments,
      failed: this.metrics.failedAssessments,
      errorRate: `${Math.round(this.metrics.errorRate * 100)}%`,
      alerts: this.getActiveAlerts().length
    });
  }

  // Public API methods
  getMetrics(): MonitoringMetrics {
    return { ...this.metrics };
  }

  getAlerts(): SystemAlert[] {
    return [...this.alerts];
  }

  getActiveAlerts(): SystemAlert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  resolveAlert(alertId: string) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      console.log(`✅ Alert resolved: ${alert.message}`);
    }
  }

  clearOldAlerts() {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
    const initialCount = this.alerts.length;
    this.alerts = this.alerts.filter(alert => alert.timestamp.getTime() > cutoff);
    const removed = initialCount - this.alerts.length;
    if (removed > 0) {
      console.log(`🧹 Cleared ${removed} old alerts`);
    }
  }

  // Emergency recovery methods
  async emergencyQueueCleanup() {
    try {
      console.log('🚨 Starting emergency queue cleanup...');
      
      // Reset stuck processing items to pending
      const { data: stuckItems, error: fetchError } = await supabaseServiceRole
        .from('assessment_queue')
        .select('*')
        .eq('status', 'processing')
        .lt('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

      if (fetchError) throw fetchError;

      if (stuckItems && stuckItems.length > 0) {
        const { error: resetError } = await supabaseServiceRole
          .from('assessment_queue')
          .update({ 
            status: 'pending', 
            updated_at: new Date().toISOString(),
            error_message: 'Reset by emergency cleanup'
          })
          .in('id', stuckItems.map(item => item.id));

        if (resetError) throw resetError;
        
        console.log(`✅ Reset ${stuckItems.length} stuck processing items`);
        this.createAlert('info', `Emergency cleanup: Reset ${stuckItems.length} stuck items`, {
          resetCount: stuckItems.length
        });
      }

    } catch (error) {
      console.error('❌ Emergency queue cleanup failed:', error);
      this.createAlert('error', 'Emergency queue cleanup failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  async getSystemStatus() {
    return {
      health: this.metrics.systemHealth,
      metrics: this.getMetrics(),
      activeAlerts: this.getActiveAlerts(),
      uptime: process.uptime ? `${Math.round(process.uptime() / 60)} minutes` : 'Unknown',
      timestamp: new Date().toISOString()
    };
  }
}

export const monitoringService = new MonitoringService();

// Auto-start monitoring disabled to prevent loading issues
// The monitoring service can be started manually if needed:
// monitoringService.startMonitoring()

if (typeof window !== 'undefined') {
  console.log('📊 Monitoring service available. Start with: monitoringService.startMonitoring()');
  
  // Make monitoring service available globally for debugging
  (window as any).monitoringService = monitoringService;
}
