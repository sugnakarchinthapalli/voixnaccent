import React, { useState } from 'react';
import { X, Plus, Upload, Download, Link as LinkIcon, Clock, Users, AlertCircle, CheckCircle, Copy } from 'lucide-react';
import { Button } from '../UI/Button';
import { supabase } from '../../lib/supabase';

interface GenerateAssessmentProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface CandidateInput {
  name: string;
  email: string;
}

export function GenerateAssessment({ onClose, onSuccess }: GenerateAssessmentProps) {
  // State for candidate management
  const [candidates, setCandidates] = useState<CandidateInput[]>([{ name: '', email: '' }]);
  
  // State for generation process
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [generatedLinks, setGeneratedLinks] = useState<Array<{ name: string; email: string; link: string }>>([]);
  const [error, setError] = useState('');
  
  // State for bulk input functionality
  const [bulkInput, setBulkInput] = useState('');
  const [showBulkInput, setShowBulkInput] = useState(false);
  
  // State for copy feedback
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  /**
   * Adds a new empty candidate to the list
   */
  const addCandidate = () => {
    setCandidates([...candidates, { name: '', email: '' }]);
  };

  /**
   * Removes a candidate from the list (minimum 1 candidate required)
   */
  const removeCandidate = (index: number) => {
    if (candidates.length > 1) {
      setCandidates(candidates.filter((_, i) => i !== index));
    }
  };

  /**
   * Updates a specific candidate's field
   */
  const updateCandidate = (index: number, field: keyof CandidateInput, value: string) => {
    const updated = [...candidates];
    updated[index][field] = value;
    setCandidates(updated);
  };

  /**
   * Parses bulk input text into candidate objects
   * Supports multiple formats: "Name, Email", "Name <email>", tab-separated
   */
  const parseBulkInput = () => {
    try {
      const lines = bulkInput.trim().split('\n');
      const parsed: CandidateInput[] = [];
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        // Support both "Name, Email" and "Name <email>" formats
        let name = '';
        let email = '';
        
        if (trimmed.includes('<') && trimmed.includes('>')) {
          // Format: "John Doe <john@example.com>"
          const match = trimmed.match(/^(.+?)\s*<(.+?)>$/);
          if (match) {
            name = match[1].trim();
            email = match[2].trim();
          }
        } else if (trimmed.includes(',')) {
          // Format: "John Doe, john@example.com"
          const parts = trimmed.split(',');
          if (parts.length >= 2) {
            name = parts[0].trim();
            email = parts[1].trim();
          }
        } else if (trimmed.includes('\t')) {
          // Tab-separated format
          const parts = trimmed.split('\t');
          if (parts.length >= 2) {
            name = parts[0].trim();
            email = parts[1].trim();
          }
        }
        
        if (name && email && email.includes('@')) {
          parsed.push({ name, email });
        }
      }
      
      if (parsed.length === 0) {
        throw new Error('No valid candidates found. Please use format: "Name, Email" or "Name <email>" (one per line)');
      }
      
      setCandidates(parsed);
      setShowBulkInput(false);
      setBulkInput('');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse bulk input');
    }
  };

  /**
   * Validates candidate data before generation
   * Checks for required fields and duplicate emails
   */
  const validateCandidates = () => {
    const validCandidates = candidates.filter(c => c.name.trim() && c.email.trim() && c.email.includes('@'));
    
    if (validCandidates.length === 0) {
      setError('Please add at least one candidate with valid name and email');
      return false;
    }
    
    // Check for duplicate emails
    const emails = validCandidates.map(c => c.email.toLowerCase());
    const duplicates = emails.filter((email, index) => emails.indexOf(email) !== index);
    
    if (duplicates.length > 0) {
      setError(`Duplicate emails found: ${duplicates.join(', ')}`);
      return false;
    }
    
    return true;
  };

  /**
   * Generates unique assessment links for all valid candidates
   * Creates candidate records in database with scheduled status
   */
  const generateAssessmentLinks = async () => {
    if (!validateCandidates()) return;
    
    setGenerating(true);
    setError('');
    
    try {
      const validCandidates = candidates.filter(c => c.name.trim() && c.email.trim() && c.email.includes('@'));
      const links: Array<{ name: string; email: string; link: string }> = [];
      
      for (const candidate of validCandidates) {
        // Generate unique session ID
        const sessionId = crypto.randomUUID();
        
        // Calculate session expiry (24 hours from now)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        
        // Create candidate record with scheduled assessment
        const { data: candidateRecord, error: candidateError } = await supabase
          .from('candidates')
          .insert({
            name: candidate.name.trim(),
            email: candidate.email.trim(),
            audio_source: null, // Will be populated when candidate completes assessment
            source_type: 'scheduled', // Indicates this is a generated assessment link
            assessment_link_id: sessionId, // Unique identifier for the assessment link
            assessment_status: 'pending', // Initial status
            session_expires_at: expiresAt.toISOString(), // 24-hour expiry
            proctoring_flags: {} // Will store proctoring data when assessment is taken
          })
          .select()
          .single();
        
        if (candidateError) {
          console.error('Error creating candidate:', candidateError);
          throw new Error(`Failed to create candidate ${candidate.name}: ${candidateError.message}`);
        }
        
        // Generate assessment link
        const assessmentLink = `${window.location.origin}/commstest/${sessionId}`;
        
        links.push({
          name: candidate.name,
          email: candidate.email,
          link: assessmentLink
        });
      }
      
      setGeneratedLinks(links);
      setGenerated(true);
      
    } catch (err) {
      console.error('Error generating assessment links:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate assessment links');
    } finally {
      setGenerating(false);
    }
  };

  /**
   * Copies a single assessment link to clipboard with visual feedback
   */
  const copyLink = async (link: string, linkId: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLinkId(linkId);
      // Clear feedback after 2 seconds
      setTimeout(() => setCopiedLinkId(null), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = link;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedLinkId(linkId);
      setTimeout(() => setCopiedLinkId(null), 2000);
    }
  };

  /**
   * Copies all generated links to clipboard in a formatted list
   */
  const copyAllLinks = async () => {
    const allLinks = generatedLinks.map(item => 
      `${item.name} (${item.email}): ${item.link}`
    ).join('\n\n');
    
    try {
      await navigator.clipboard.writeText(allLinks);
      setCopiedLinkId('all');
      setTimeout(() => setCopiedLinkId(null), 2000);
    } catch (err) {
      console.error('Failed to copy all links:', err);
    }
  };

  /**
   * Downloads all generated links as a CSV file
   */
  const downloadLinksCSV = () => {
    const csvContent = [
      ['Name', 'Email', 'Assessment Link'],
      ...generatedLinks.map(item => [item.name, item.email, item.link])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `assessment_links_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Success state - show generated links
  if (generated) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Assessment Links Generated</h2>
              <p className="text-sm text-green-600 font-medium">
                {generatedLinks.length} assessment link{generatedLinks.length > 1 ? 's' : ''} created successfully
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="p-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <Clock className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
                <div>
                  <h3 className="font-medium text-blue-800">Important Information</h3>
                  <ul className="text-sm text-blue-700 mt-1 space-y-1">
                    <li>• Each assessment link expires in 24 hours</li>
                    <li>• Candidates have 3 minutes to complete the assessment once they start</li>
                    <li>• Links can only be used once</li>
                    <li>• Results will appear in the main dashboard once completed</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Generated Links</h3>
              <div className="flex space-x-2">
                <Button
                  onClick={copyAllLinks}
                  variant="outline"
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <Copy className="h-4 w-4" />
                  <span>{copiedLinkId === 'all' ? 'Copied!' : 'Copy All'}</span>
                </Button>
                <Button
                  onClick={downloadLinksCSV}
                  variant="outline"
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <Download className="h-4 w-4" />
                  <span>Download CSV</span>
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {generatedLinks.map((item, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-medium text-gray-900">{item.name}</h4>
                      <p className="text-sm text-gray-600">{item.email}</p>
                    </div>
                    <Button
                      onClick={() => copyLink(item.link, `link-${index}`)}
                      variant="outline"
                      size="sm"
                      className="flex items-center space-x-2"
                    >
                      <Copy className="h-4 w-4" />
                      <span>{copiedLinkId === `link-${index}` ? 'Copied!' : 'Copy Link'}</span>
                    </Button>
                  </div>
                  <div className="bg-white p-3 rounded border font-mono text-sm break-all">
                    {item.link}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end space-x-3 pt-6 border-t mt-6">
              <Button onClick={onSuccess} className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4" />
                <span>Done</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main generation interface
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Generate Assessment Links</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Information Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <Clock className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
              <div>
                <h3 className="font-medium text-blue-800">Assessment Link Features</h3>
                <ul className="text-sm text-blue-700 mt-1 space-y-1">
                  <li>• Each link expires in 24 hours from creation</li>
                  <li>• 3-minute timed assessment with proctoring features</li>
                  <li>• Tab focus monitoring and copy protection</li>
                  <li>• Automatic identity verification via webcam snapshots</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Bulk Input Toggle */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Add Candidates</h3>
            <Button
              onClick={() => setShowBulkInput(!showBulkInput)}
              variant="outline"
              className="flex items-center space-x-2"
            >
              <Users className="h-4 w-4" />
              <span>{showBulkInput ? 'Individual Entry' : 'Bulk Entry'}</span>
            </Button>
          </div>

          {showBulkInput ? (
            /* Bulk Input */
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bulk Candidate Entry
                </label>
                <textarea
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  placeholder={`Enter candidates in one of these formats (one per line):
John Doe, john@example.com
Jane Smith <jane@example.com>
Bob Johnson	bob@example.com`}
                  rows={8}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Supports formats: "Name, Email", "Name &lt;email&gt;", or tab-separated values
                </p>
              </div>
              <Button
                onClick={parseBulkInput}
                disabled={!bulkInput.trim()}
                className="flex items-center space-x-2"
              >
                <Upload className="h-4 w-4" />
                <span>Parse Candidates</span>
              </Button>
            </div>
          ) : (
            /* Individual Entry */
            <div className="space-y-4">
              {candidates.map((candidate, index) => (
                <div key={index} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Candidate Name"
                      value={candidate.name}
                      onChange={(e) => updateCandidate(index, 'name', e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      type="email"
                      placeholder="candidate@example.com"
                      value={candidate.email}
                      onChange={(e) => updateCandidate(index, 'email', e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  {candidates.length > 1 && (
                    <Button
                      onClick={() => removeCandidate(index)}
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}

              <Button
                onClick={addCandidate}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Add Another Candidate</span>
              </Button>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={generating}
            >
              Cancel
            </Button>
            <Button
              onClick={generateAssessmentLinks}
              loading={generating}
              disabled={generating}
              className="flex items-center space-x-2"
            >
              <LinkIcon className="h-4 w-4" />
              <span>{generating ? 'Generating Links...' : 'Generate Assessment Links'}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}