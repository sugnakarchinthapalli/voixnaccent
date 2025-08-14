import jsPDF from 'jspdf';
import { Assessment } from '../types';

export async function exportAssessmentToPDF(assessment: Assessment): Promise<void> {
  try {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    
    let yPosition = margin;
    const lineHeight = 6;
    const sectionSpacing = 8;
    
    // Helper function to add text with word wrapping
    const addText = (text: string, fontSize: number = 10, isBold: boolean = false, color: string = '#000000') => {
      pdf.setFontSize(fontSize);
      pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
      
      // Convert hex color to RGB
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      pdf.setTextColor(r, g, b);
      
      const lines = pdf.splitTextToSize(text, contentWidth);
      
      // Check if we need a new page
      if (yPosition + (lines.length * lineHeight) > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }
      
      pdf.text(lines, margin, yPosition);
      yPosition += lines.length * lineHeight;
      
      // Reset color to black
      pdf.setTextColor(0, 0, 0);
    };
    
    const addSection = (title: string, content: string, titleColor: string = '#1991bd') => {
      yPosition += sectionSpacing;
      addText(title, 12, true, titleColor);
      yPosition += 2;
      addText(content, 10);
    };
    
    // Determine assessment type and data
    const isNewCEFRAssessment = assessment.overall_cefr_level;
    const framework = isNewCEFRAssessment ? 'CEFR Framework' : 'Competency System';
    
    // Header
    addText('MediaMint Voice Assessment Report', 18, true, '#1991bd');
    addText(`Assessment Framework: ${framework}`, 11, false, '#666666');
    yPosition += sectionSpacing;
    
    // Candidate Information
    addText('CANDIDATE INFORMATION', 14, true, '#1991bd');
    yPosition += 2;
    addText(`Name: ${assessment.candidate?.name || 'Unknown Candidate'}`, 11, true);
    addText(`Email: ${assessment.candidate?.email || 'No email provided'}`, 10);
    addText(`Assessment Date: ${new Date(assessment.assessment_date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`, 10);
    addText(`Evaluated By: ${assessment.assessed_by}`, 10);
    
    // Assessment Question (if available)
    if (assessment.question) {
      addSection('ASSESSMENT QUESTION', assessment.question.text);
    }
    
    // Assessment Result
    if (isNewCEFRAssessment) {
      // CEFR Assessment
      const cefrDescriptions = {
        'C2': 'Mastery - Near-native proficiency',
        'C1': 'Proficiency - Advanced level',
        'B2': 'Upper-Intermediate - Independent user',
        'B1': 'Intermediate - Basic independent user',
        'A2': 'Elementary - Basic user',
        'A1': 'Beginner - Very basic language use'
      };
      
      const description = cefrDescriptions[assessment.overall_cefr_level as keyof typeof cefrDescriptions] || assessment.overall_cefr_level;
      
      addSection('CEFR ASSESSMENT RESULT', `Level: ${assessment.overall_cefr_level} - ${description}`, '#10B981');
      
      if (assessment.detailed_analysis) {
        addSection('DETAILED ANALYSIS', assessment.detailed_analysis);
      }
      
      if (assessment.specific_strengths) {
        addSection('SPECIFIC STRENGTHS', assessment.specific_strengths, '#10B981');
      }
      
      if (assessment.areas_for_improvement) {
        addSection('AREAS FOR IMPROVEMENT', assessment.areas_for_improvement, '#F59E0B');
      }
      
      if (assessment.score_justification) {
        addSection('SCORE JUSTIFICATION', assessment.score_justification);
      }
      
    } else {
      // Legacy Competency Assessment
      const scores = assessment.assessment_scores;
      if (scores && typeof scores === 'object' && scores.clarity_articulation) {
        const competencyScores = [
          scores.clarity_articulation || 0,
          scores.pace || 0,
          scores.tone_modulation || 0,
          scores.accent_neutrality || 0,
          scores.confidence_energy || 0,
          scores.grammar_fluency || 0
        ];
        const overallScore = (competencyScores.reduce((sum, score) => sum + score, 0) / competencyScores.length).toFixed(1);
        
        addSection('COMPETENCY ASSESSMENT RESULT', `Overall Score: ${overallScore}/5.0 (${assessment.overall_grade})`, '#F59E0B');
        
        // Competency breakdown
        addText('COMPETENCY BREAKDOWN', 12, true, '#1991bd');
        yPosition += 2;
        
        const competencyLabels = {
          clarity_articulation: 'Clarity & Articulation',
          pace: 'Pace',
          tone_modulation: 'Tone & Modulation',
          accent_neutrality: 'Accent Neutrality',
          confidence_energy: 'Confidence & Energy',
          grammar_fluency: 'Grammar & Fluency'
        };
        
        Object.entries(competencyLabels).forEach(([key, label]) => {
          const score = scores[key] || 0;
          addText(`${label}: ${score}/5`, 10);
        });
      }
      
      if (assessment.ai_feedback && assessment.ai_feedback.trim()) {
        addSection('OVERALL FEEDBACK', assessment.ai_feedback.trim());
      }
    }
    
    // Footer
    yPosition = pageHeight - 30;
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text('MediaMint Voice Assessment Tool - AI-powered communications evaluation', margin, yPosition);
    pdf.text(`Generated on ${new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}`, margin, yPosition + 5);
    pdf.text('www.mediamint.com/careers', pageWidth - margin - 40, yPosition + 5);
    
    // Save the PDF
    const fileName = `Voice_Assessment_${assessment.candidate?.name?.replace(/\s+/g, '_') || 'Unknown'}_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF report');
  }
}