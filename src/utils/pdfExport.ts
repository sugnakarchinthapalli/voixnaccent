import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Assessment } from '../types';

export async function exportAssessmentToPDF(assessment: Assessment): Promise<void> {
  try {
    // Create a temporary container for the PDF content
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '210mm'; // A4 width
    container.style.backgroundColor = 'white';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.fontSize = '12px';
    container.style.lineHeight = '1.4';
    container.style.color = '#333';
    
    // Generate the HTML content
    container.innerHTML = generatePDFContent(assessment);
    
    // Add to DOM temporarily
    document.body.appendChild(container);
    
    // Wait for fonts and images to load
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Convert to canvas
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: container.offsetWidth,
      height: container.offsetHeight
    });
    
    // Remove from DOM
    document.body.removeChild(container);
    
    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210; // A4 width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    // Add the canvas as image to PDF
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    
    // Save the PDF
    const fileName = `Voice_Assessment_${assessment.candidate?.name?.replace(/\s+/g, '_') || 'Unknown'}_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF report');
  }
}

function generatePDFContent(assessment: Assessment): string {
  const getOverallScore = () => {
    const scores = assessment.assessment_scores;
    if (!scores || typeof scores !== 'object') return 0;
    
    const competencyScores = [
      scores.clarity_articulation || 0,
      scores.pace || 0,
      scores.tone_modulation || 0,
      scores.accent_neutrality || 0,
      scores.confidence_energy || 0,
      scores.grammar_fluency || 0
    ];

    return Math.round(competencyScores.reduce((sum, score) => sum + score, 0) / competencyScores.length * 10) / 10;
  };

  const getGradeColor = (score: number) => {
    if (score >= 4) return '#10B981'; // Green
    if (score >= 3) return '#F59E0B'; // Amber
    return '#EF4444'; // Red
  };

  const getGradeLabel = (score: number) => {
    if (score >= 4) return 'Green';
    if (score >= 3) return 'Amber';
    return 'Red';
  };

  const competencyLabels = {
    clarity_articulation: 'Clarity & Articulation',
    pace: 'Pace',
    tone_modulation: 'Tone & Modulation',
    accent_neutrality: 'Accent Neutrality',
    confidence_energy: 'Confidence & Energy',
    grammar_fluency: 'Grammar & Fluency'
  };

  const overallScore = getOverallScore();
  const gradeColor = getGradeColor(overallScore);
  const gradeLabel = getGradeLabel(overallScore);

  return `
    <div style="width: 210mm; min-height: 297mm; padding: 20mm; box-sizing: border-box; background: white;">
      <!-- Header Section -->
      <div style="border-bottom: 3px solid #1e40af; padding-bottom: 15px; margin-bottom: 30px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div>
            <h1 style="margin: 0; font-size: 24px; font-weight: bold; color: #1e40af;">MediaMint</h1>
            <p style="margin: 5px 0 0 0; font-size: 14px; color: #6b7280;">Voice Assessment Report</p>
          </div>
          <div style="text-align: right;">
            <div style="background: ${gradeColor}; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; font-size: 14px;">
              Overall Grade: ${gradeLabel}
            </div>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #6b7280;">Score: ${overallScore}/5.0</p>
          </div>
        </div>
      </div>

      <!-- Candidate Information -->
      <div style="margin-bottom: 30px;">
        <h2 style="margin: 0 0 15px 0; font-size: 18px; font-weight: bold; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px;">
          Candidate Information
        </h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div>
            <p style="margin: 0 0 8px 0;"><strong>Name:</strong> ${assessment.candidate?.name || 'Unknown Candidate'}</p>
            <p style="margin: 0 0 8px 0;"><strong>Email:</strong> ${assessment.candidate?.email || 'No email provided'}</p>
          </div>
          <div>
            <p style="margin: 0 0 8px 0;"><strong>Assessment Date:</strong> ${new Date(assessment.assessment_date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
            <p style="margin: 0 0 8px 0;"><strong>Assessed By:</strong> ${assessment.assessed_by}</p>
          </div>
        </div>
      </div>

      <!-- Assessment Question -->
      ${assessment.question ? `
        <div style="margin-bottom: 30px;">
          <h2 style="margin: 0 0 15px 0; font-size: 18px; font-weight: bold; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px;">
            Assessment Question
          </h2>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6;">
            <p style="margin: 0; color: #374151; line-height: 1.6;">${assessment.question.text}</p>
            <div style="margin-top: 10px;">
              <span style="background: #dbeafe; color: #1e40af; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 500;">
                ${assessment.question.difficulty_level}
              </span>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Overall Assessment -->
      <div style="margin-bottom: 30px; text-align: center;">
        <h2 style="margin: 0 0 20px 0; font-size: 18px; font-weight: bold; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px;">
          Overall Assessment
        </h2>
        <div style="display: inline-flex; align-items: center; gap: 15px; background: #f9fafb; padding: 20px; border-radius: 12px; border: 2px solid #e5e7eb;">
          <div style="font-size: 48px; font-weight: bold; color: #374151;">${overallScore}</div>
          <div style="width: 24px; height: 24px; border-radius: 50%; background: ${gradeColor};"></div>
          <div style="text-align: left;">
            <div style="font-size: 16px; font-weight: bold; color: #374151;">Grade: ${gradeLabel}</div>
            <div style="font-size: 12px; color: #6b7280;">Out of 5.0</div>
          </div>
        </div>
      </div>

      <!-- Competency Breakdown -->
      <div style="margin-bottom: 30px;">
        <h2 style="margin: 0 0 20px 0; font-size: 18px; font-weight: bold; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px;">
          Competency Breakdown
        </h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          ${Object.entries(competencyLabels).map(([key, label]) => {
            const score = assessment.assessment_scores?.[key as keyof typeof competencyLabels] || 0;
            const feedback = assessment.assessment_scores?.feedback?.[key as keyof typeof competencyLabels] || '';
            const scoreColor = getGradeColor(score);
            
            return `
              <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                  <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: #374151;">${label}</h3>
                  <div style="background: ${scoreColor}; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">
                    ${score}/5
                  </div>
                </div>
                ${feedback ? `<p style="margin: 0; font-size: 11px; color: #6b7280; line-height: 1.5;">${feedback}</p>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- AI Feedback -->
      ${assessment.ai_feedback ? `
        <div style="margin-bottom: 30px;">
          <h2 style="margin: 0 0 15px 0; font-size: 18px; font-weight: bold; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px;">
            Overall Feedback
          </h2>
          <div style="background: #eff6ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6;">
            <p style="margin: 0; color: #374151; line-height: 1.6;">${assessment.ai_feedback}</p>
          </div>
        </div>
      ` : ''}

      <!-- Footer -->
      <div style="position: absolute; bottom: 20mm; left: 20mm; right: 20mm; border-top: 2px solid #e5e7eb; padding-top: 15px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <p style="margin: 0; font-size: 12px; color: #6b7280;">
              <strong>MediaMint Voice Assessment Tool</strong>
            </p>
            <p style="margin: 2px 0 0 0; font-size: 10px; color: #9ca3af;">
              AI-powered communications evaluation
            </p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-size: 10px; color: #9ca3af;">
              Generated on ${new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
            <p style="margin: 2px 0 0 0; font-size: 10px; color: #9ca3af;">
              www.mediamint.com/careers
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}