import React, { useState, useEffect } from 'react';
import { Clock, PlayCircle, CheckCircle, AlertCircle } from 'lucide-react';
import { assessmentService } from '../../services/assessmentService';

export function QueueStatus() {
  const [queueStatus, setQueueStatus] = useState({
    pending: 0,
    processing: 0,
    position: null as number | null
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

  if (totalInQueue === 0) {
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

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {queueStatus.processing > 0 ? (
            <PlayCircle className="h-5 w-5 text-blue-600 mr-3 animate-pulse" />
          ) : (
            <Clock className="h-5 w-5 text-blue-600 mr-3" />
          )}
          <div>
            <p className="text-sm font-medium text-blue-800">Assessment Queue Status</p>
            <p className="text-sm text-blue-700">
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
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {queueStatus.processing > 0 && (
            <div className="flex items-center text-sm text-blue-700">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              Processing
            </div>
          )}
          
          <div className="text-right">
            <div className="text-lg font-bold text-blue-900">{totalInQueue}</div>
            <div className="text-xs text-blue-700">in queue</div>
          </div>
        </div>
      </div>
      
      {queueStatus.processing > 0 && (
        <div className="mt-3 pt-3 border-t border-blue-200">
          <div className="flex items-center text-xs text-blue-600">
            <AlertCircle className="h-3 w-3 mr-1" />
            <span>Processing up to 2 assessments simultaneously with 3-second delays between API calls</span>
          </div>
        </div>
      )}
    </div>
  );
}