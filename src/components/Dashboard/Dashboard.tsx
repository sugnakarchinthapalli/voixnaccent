import React, { useState, useEffect } from 'react';
import { Plus, Download, RefreshCw, Search, Filter } from 'lucide-react';
import { AssessmentTable } from './AssessmentTable';
import { ManualUpload } from './ManualUpload';
import { QueueStatus } from './QueueStatus';
import { Button } from '../UI/Button';
import { assessmentService } from '../../services/assessmentService';
import { sheetsMonitorService } from '../../services/sheetsMonitorService';
import { Assessment } from '../../types';
import { exportToCSV } from '../../utils/csvExport';

export function Dashboard() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [filteredAssessments, setFilteredAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    assessedBy: '',
    overallGrade: '',
    dateFrom: '',
    dateTo: ''
  });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAssessments();
    
    // Start monitoring Google Sheets
    sheetsMonitorService.startMonitoring();
    
    // Set up periodic refresh
    const interval = setInterval(loadAssessments, 30000); // Refresh every 30 seconds
    
    return () => {
      clearInterval(interval);
      sheetsMonitorService.stopMonitoring();
    };
  }, []);

  useEffect(() => {
    applyFilters();
  }, [assessments, searchQuery, filters]);

  const loadAssessments = async () => {
    try {
      const data = await assessmentService.getAllAssessments();
      setAssessments(data);
    } catch (error) {
      console.error('Error loading assessments:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...assessments];

    // Apply search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(assessment =>
        assessment.candidate?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        assessment.candidate?.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        assessment.assessed_by.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply filters
    if (filters.assessedBy) {
      filtered = filtered.filter(assessment => 
        assessment.assessed_by === filters.assessedBy
      );
    }

    if (filters.overallGrade) {
      filtered = filtered.filter(assessment => 
        assessment.overall_grade === filters.overallGrade
      );
    }

    if (filters.dateFrom) {
      filtered = filtered.filter(assessment => 
        new Date(assessment.assessment_date) >= new Date(filters.dateFrom)
      );
    }

    if (filters.dateTo) {
      filtered = filtered.filter(assessment => 
        new Date(assessment.assessment_date) <= new Date(filters.dateTo + 'T23:59:59')
      );
    }

    setFilteredAssessments(filtered);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await sheetsMonitorService.manualSync();
      await loadAssessments();
    } finally {
      setRefreshing(false);
    }
  };

  const handleExportCSV = () => {
    exportToCSV(filteredAssessments, 'voice_assessments');
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilters({
      assessedBy: '',
      overallGrade: '',
      dateFrom: '',
      dateTo: ''
    });
  };

  const getUniqueAssessors = () => {
    const assessors = [...new Set(assessments.map(a => a.assessed_by))];
    return assessors.sort();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading assessments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Voice Assessments</h1>
              <p className="text-gray-600 mt-1">
                AI-powered voice evaluation dashboard
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                onClick={handleRefresh}
                variant="outline"
                disabled={refreshing}
                className="flex items-center space-x-2"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span>Sync</span>
              </Button>
              <Button
                onClick={() => setShowUpload(true)}
                className="flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Manual Upload</span>
              </Button>
            </div>
          </div>

          {/* Queue Status */}
          <QueueStatus />

          {/* Search and Filters */}
          <div className="bg-white p-6 rounded-lg shadow-sm border space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center space-y-4 lg:space-y-0 lg:space-x-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search candidates, emails, or assessors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Export Button */}
              <Button
                onClick={handleExportCSV}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Export CSV</span>
              </Button>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assessed By
                </label>
                <select
                  value={filters.assessedBy}
                  onChange={(e) => setFilters(prev => ({ ...prev, assessedBy: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Assessors</option>
                  {getUniqueAssessors().map(assessor => (
                    <option key={assessor} value={assessor}>{assessor}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Overall Grade
                </label>
                <select
                  value={filters.overallGrade}
                  onChange={(e) => setFilters(prev => ({ ...prev, overallGrade: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Grades</option>
                  <option value="Green">Green</option>
                  <option value="Amber">Amber</option>
                  <option value="Red">Red</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date From
                </label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date To
                </label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {(searchQuery || Object.values(filters).some(v => v)) && (
              <div className="flex items-center justify-between pt-4 border-t">
                <p className="text-sm text-gray-600">
                  Showing {filteredAssessments.length} of {assessments.length} assessments
                </p>
                <Button
                  onClick={clearFilters}
                  variant="outline"
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <Filter className="h-3 w-3" />
                  <span>Clear Filters</span>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Assessment Table */}
        <AssessmentTable assessments={filteredAssessments} />

        {/* Manual Upload Modal */}
        {showUpload && (
          <ManualUpload
            onClose={() => setShowUpload(false)}
            onSuccess={() => {
              setShowUpload(false);
              loadAssessments();
            }}
          />
        )}
      </div>
    </div>
  );
}