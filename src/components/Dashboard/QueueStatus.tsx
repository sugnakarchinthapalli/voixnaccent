import React, { useState, useEffect } from 'react';
import { Clock, PlayCircle, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { assessmentService } from '../../services/assessmentService';

export function QueueStatus() {
  const [queueStatus, setQueueStatus] = useState({
    pending: 0,
    processing: 0,
    position: null as number | null,
    failed: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQueueStatus = async () => {
      try {
        const status = await assessmentService.getQueueStatus();
        setQueueStatus(status);
      } catch (error) {
        console.error('Error fetching queue status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchQueueStatus();
    const interval = setInterval(fetchQueueStatus, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border p-4 mb-6">
        <div className="animate-pulse flex items-center space-x-4">
          <div className="h-4 w-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded flex-1"></div>
        </div>
      </div>
    );
  }

  const totalInQueue = queueStatus.pending + queueStatus.processing;

  if (totalInQueue === 0 && queueStatus.failed === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <div className="flex items-center">
          <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
          <div>
            <p className="text-sm font-medium text-green-800">Assessment Queue</p>
            <p className="text-sm text-green-700">All assessments completed. Ready for new submissions.</p>
          </div>
        </div>
      </div>
    );
  }

  // Show failed assessments if any
  if (queueStatus.failed > 0 && totalInQueue === 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <XCircle className="h-5 w-5 text-red-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-red-800">Assessment Queue</p>
              <p className="text-sm text-red-700">
                {queueStatus.failed} assessment{queueStatus.failed > 1 ? 's' : ''} failed after multiple retries. 
                AI service may be experiencing issues.
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-red-900">{queueStatus.failed}</div>
            <div className="text-xs text-red-700">failed</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg p-4 mb-6 ${
      queueStatus.failed > 0 
        ? 'bg-yellow-50 border border-yellow-200' 
        : 'bg-blue-50 border border-blue-200'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {queueStatus.processing > 0 ? (
            <PlayCircle className={`h-5 w-5 mr-3 animate-pulse ${
              queueStatus.failed > 0 ? 'text-yellow-600' : 'text-blue-600'
            }`} />
          ) : (
            <Clock className={`h-5 w-5 mr-3 ${
              queueStatus.failed > 0 ? 'text-yellow-600' : 'text-blue-600'
            }`} />
          )}
          <div>
            <p className={`text-sm font-medium ${
              queueStatus.failed > 0 ? 'text-yellow-800' : 'text-blue-800'
            }`}>Assessment Queue Status</p>
            <p className={`text-sm ${
              queueStatus.failed > 0 ? 'text-yellow-700' : 'text-blue-700'
            }`}>
              {queueStatus.processing > 0 && (
                <span className="font-medium">
                  {queueStatus.processing} processing now • {' '}
                </span>
              )}
              {queueStatus.pending > 0 && (
                <span>
                  {queueStatus.pending} pending
                </span>
              )}
              {queueStatus.failed > 0 && (
                <span className="text-red-600 font-medium">
                  {queueStatus.pending > 0 || queueStatus.processing > 0 ? ' • ' : ''}
                  {queueStatus.failed} failed (will retry)
                </span>
              )}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {queueStatus.processing > 0 && (
            <div className={`flex items-center text-sm ${
              queueStatus.failed > 0 ? 'text-yellow-700' : 'text-blue-700'
            }`}>
              <div className={`animate-spin rounded-full h-4 w-4 border-b-2 mr-2 ${
                queueStatus.failed > 0 ? 'border-yellow-600' : 'border-blue-600'
              }`}></div>
              Processing
            </div>
          )}
          
          <div className="text-right">
            <div className={`text-lg font-bold ${
              queueStatus.failed > 0 ? 'text-yellow-900' : 'text-blue-900'
            }`}>{totalInQueue}</div>
            <div className={`text-xs ${
              queueStatus.failed > 0 ? 'text-yellow-700' : 'text-blue-700'
            }`}>in queue</div>
          </div>
        </div>
      </div>
      
      {queueStatus.processing > 0 && (
        <div className={`mt-3 pt-3 border-t ${
          queueStatus.failed > 0 ? 'border-yellow-200' : 'border-blue-200'
        }`}>
          <div className={`flex items-center text-xs ${
            queueStatus.failed > 0 ? 'text-yellow-600' : 'text-blue-600'
          }`}>
            <AlertCircle className="h-3 w-3 mr-1" />
            <span>Processing up to 2 assessments simultaneously with automatic retry on failures</span>
          </div>
        </div>
      )}
    </div>
  );
}