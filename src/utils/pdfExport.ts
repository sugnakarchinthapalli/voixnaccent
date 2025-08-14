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
    container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    container.style.fontSize = '14px';
    container.style.lineHeight = '1.5';
    container.style.color = '#1f2937';
    container.style.padding = '0';
    container.style.margin = '0';
    
    // Generate the HTML content
    container.innerHTML = generatePDFContent(assessment);
    
    // Add to DOM temporarily
    document.body.appendChild(container);
    
    // Wait for fonts and images to load
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Convert to canvas with high quality settings
    const canvas = await html2canvas(container, {
      scale: 1.5, // Reduced scale for smaller file size
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: container.offsetWidth,
      height: container.offsetHeight,
      logging: false,
      imageTimeout: 15000,
      removeContainer: true,
      quality: 0.8 // Reduce quality for smaller file size
    });
    
    // Remove from DOM
    document.body.removeChild(container);
    
    // Create PDF with high quality
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210; // A4 width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    // Add the canvas as image to PDF
    const imgData = canvas.toDataURL('image/jpeg', 0.85); // Use JPEG with compression
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
  const isNewCEFRAssessment = assessment.overall_cefr_level;
  
  const getCEFRColor = (level: string) => {
    switch (level) {
      case 'C2':
      case 'C1':
        return '#10B981'; // Green
      case 'B2':
      case 'B1':
        return '#F59E0B'; // Amber
      case 'A2':
      case 'A1':
      default:
        return '#EF4444'; // Red
    }
  };

  const getCEFRDescription = (level: string) => {
    const descriptions = {
      'C2': 'Mastery - Near-native proficiency',
      'C1': 'Proficiency - Advanced level',
      'B2': 'Upper-Intermediate - Independent user',
      'B1': 'Intermediate - Basic independent user',
      'A2': 'Elementary - Basic user',
      'A1': 'Beginner - Very basic language use'
    };
    return descriptions[level as keyof typeof descriptions] || level;
  };

  // Determine colors and labels based on assessment type
  let gradeColor, gradeLabel, displayScore;
  
  if (isNewCEFRAssessment) {
    gradeColor = getCEFRColor(assessment.overall_cefr_level!);
    gradeLabel = assessment.overall_cefr_level!;
    displayScore = getCEFRDescription(assessment.overall_cefr_level!);
  } else {
    // Legacy assessment
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
      const overallScore = Math.round(competencyScores.reduce((sum, score) => sum + score, 0) / competencyScores.length * 10) / 10;
      gradeColor = overallScore >= 4 ? '#10B981' : overallScore >= 3 ? '#F59E0B' : '#EF4444';
      gradeLabel = overallScore >= 4 ? 'Green' : overallScore >= 3 ? 'Amber' : 'Red';
      displayScore = `${overallScore}/5.0`;
    } else {
      gradeColor = '#6B7280';
      gradeLabel = 'N/A';
      displayScore = 'No Score';
    }
  }

  return `
    <div style="width: 794px; min-height: 1123px; background: white; position: relative; box-sizing: border-box; font-family: Arial, sans-serif;">
      <!-- Header Section -->
      <div style="background: #1991bd; color: white; padding: 30px 40px; margin: 0;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div>
            <h1 style="margin: 0; font-size: 36px; font-weight: 700; letter-spacing: -0.5px; color: white;">MediaMint</h1>
            <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9; font-weight: 400;">
              Voice Assessment Report ${isNewCEFRAssessment ? '(CEFR Framework)' : '(Competency System)'}
            </p>
            <div style="width: 60px; height: 3px; background: rgba(255,255,255,0.6); margin-top: 12px; border-radius: 2px;"></div>
          </div>
          <div style="text-align: right;">
            <div style="background: ${gradeColor}; color: white; padding: 12px 24px; border-radius: 25px; font-weight: 700; font-size: 16px; display: flex; align-items: center; justify-content: center; min-height: 20px;">
              ${gradeLabel}
            </div>
            <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.8; font-weight: 500;">${displayScore}</p>
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div style="padding: 40px 40px 100px 40px;">
        <!-- Candidate Information Card -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px; margin-bottom: 30px;">
          <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: #1e40af; display: flex; align-items: center;">
            <span style="display: inline-block; width: 8px; height: 8px; background: #1991bd; border-radius: 50%; margin-right: 10px;"></span>
            Candidate Information
          </h2>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div>
              <label style="display: block; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Full Name</label>
              <p style="margin: 0; font-size: 16px; font-weight: 500; color: #111827;">${assessment.candidate?.name || 'Unknown Candidate'}</p>
            </div>
            <div>
              <label style="display: block; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Email Address</label>
              <p style="margin: 0; font-size: 16px; color: #374151;">${assessment.candidate?.email || 'No email provided'}</p>
            </div>
            <div>
              <label style="display: block; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Assessment Date</label>
              <p style="margin: 0; font-size: 16px; color: #374151;">${new Date(assessment.assessment_date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</p>
            </div>
            <div>
              <label style="display: block; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Evaluated By</label>
              <div style="display: inline-flex; align-items: center; background: ${
                assessment.assessed_by === 'Form Response' 
                  ? '#dbeafe' 
                  : assessment.assessed_by === 'Candidate Submission'
                  ? '#e0e7ff'
                  : '#d1fae5'
              }; color: ${
                assessment.assessed_by === 'Form Response' 
                  ? '#1e40af' 
                  : assessment.assessed_by === 'Candidate Submission'
                  ? '#5b21b6'
                  : '#065f46'
              }; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 500;">
                ${assessment.assessed_by}
              </div>
            </div>
          </div>
        </div>

        ${assessment.question ? `
          <!-- Assessment Question Card -->
          <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1px solid #bfdbfe; border-radius: 12px; padding: 30px; margin-bottom: 35px; position: relative; overflow: hidden;">
            <div style="position: absolute; top: -10px; right: -10px; width: 60px; height: 60px; background: rgba(25, 145, 189, 0.1); border-radius: 50%;"></div>
            <h2 style="margin: 0 0 18px 0; font-size: 20px; font-weight: 600; color: #1991bd; position: relative; z-index: 2;">Assessment Question</h2>
            <div style="background: white; padding: 25px; border-radius: 8px; border-left: 4px solid #1991bd; box-shadow: 0 2px 4px rgba(0,0,0,0.1); position: relative; z-index: 2;">
              <p style="margin: 0 0 15px 0; color: #374151; line-height: 1.6; font-size: 15px;">${assessment.question.text}</p>
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="background: #1991bd; color: white; padding: 6px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                  ${assessment.question.difficulty_level}
                </span>
                <span style="color: #6b7280; font-size: 12px;">• Maximum 2 minutes</span>
              </div>
            </div>
          </div>
        ` : ''}

        ${isNewCEFRAssessment ? `
          <!-- CEFR Assessment Result -->
          <div style="text-align: center; margin-bottom: 40px;">
            <h2 style="margin: 0 0 30px 0; font-size: 24px; font-weight: 600; color: #111827;">CEFR Assessment Result</h2>
            <div style="display: inline-block; background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); padding: 35px 45px; border-radius: 20px; border: 2px solid ${gradeColor}; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
              <div style="text-align: center;">
                <div style="font-size: 64px; font-weight: 700; color: ${gradeColor}; line-height: 1; margin-bottom: 8px;">${assessment.overall_cefr_level}</div>
                <div style="font-size: 16px; color: #6b7280; font-weight: 500;">${getCEFRDescription(assessment.overall_cefr_level!)}</div>
              </div>
            </div>
          </div>
        ` : `
          <!-- Competency Assessment Result -->
          <div style="text-align: center; margin-bottom: 40px;">
            <h2 style="margin: 0 0 30px 0; font-size: 24px; font-weight: 600; color: #111827;">Overall Assessment (Competency System)</h2>
            <div style="display: inline-block; background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); padding: 35px 45px; border-radius: 20px; border: 2px solid #e5e7eb; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
              <div style="text-align: center;">
                <div style="font-size: 48px; font-weight: 700; color: #111827; line-height: 1; margin-bottom: 8px;">${displayScore}</div>
                <div style="font-size: 16px; color: #6b7280; font-weight: 500;">Competency-based Assessment</div>
              </div>
            </div>
          </div>
        `}

        ${isNewCEFRAssessment ? `
          <!-- CEFR Assessment Details -->
          ${assessment.detailed_analysis ? `
            <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1px solid #bfdbfe; border-radius: 12px; padding: 30px; margin-bottom: 35px;">
              <h2 style="margin: 0 0 18px 0; font-size: 20px; font-weight: 600; color: #1991bd;">Detailed Analysis</h2>
              <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #1991bd; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <p style="margin: 0; color: #374151; line-height: 1.7; font-size: 15px;">${assessment.detailed_analysis}</p>
              </div>
            </div>
          ` : ''}

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-bottom: 35px;">
            ${assessment.specific_strengths ? `
              <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1px solid #bbf7d0; border-radius: 12px; padding: 25px;">
                <h3 style="margin: 0 0 15px 0; font-size: 18px; font-weight: 600; color: #166534;">Specific Strengths</h3>
                <p style="margin: 0; color: #15803d; line-height: 1.6; font-size: 14px;">${assessment.specific_strengths}</p>
              </div>
            ` : ''}

            ${assessment.areas_for_improvement ? `
              <div style="background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 1px solid #fed7aa; border-radius: 12px; padding: 25px;">
                <h3 style="margin: 0 0 15px 0; font-size: 18px; font-weight: 600; color: #92400e;">Areas for Improvement</h3>
                <p style="margin: 0; color: #d97706; line-height: 1.6; font-size: 14px;">${assessment.areas_for_improvement}</p>
              </div>
            ` : ''}
          </div>

          ${assessment.score_justification ? `
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 30px; margin-bottom: 35px;">
              <h2 style="margin: 0 0 18px 0; font-size: 20px; font-weight: 600; color: #111827;">Score Justification</h2>
              <p style="margin: 0; color: #374151; line-height: 1.7; font-size: 15px;">${assessment.score_justification}</p>
            </div>
          ` : ''}
        ` : `
          <!-- Legacy Assessment Details -->
          <div style="margin-bottom: 40px;">
            <h2 style="margin: 0 0 30px 0; font-size: 22px; font-weight: 600; color: #111827; text-align: center;">Competency Breakdown (Legacy)</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 25px;">
              ${Object.entries({
                clarity_articulation: 'Clarity & Articulation',
                pace: 'Pace',
                tone_modulation: 'Tone & Modulation',
                accent_neutrality: 'Accent Neutrality',
                confidence_energy: 'Confidence & Energy',
                grammar_fluency: 'Grammar & Fluency'
              }).map(([key, label]) => {
                const score = assessment.assessment_scores?.[key] || 0;
                const feedback = assessment.assessment_scores?.feedback?.[key] || '';
                const scoreColor = score >= 4 ? '#10B981' : score >= 3 ? '#F59E0B' : '#EF4444';
                
                return `
                  <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 25px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
                      <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #111827;">${label}</h3>
                      <div style="font-size: 18px; font-weight: 700; color: ${scoreColor};">
                        ${score}/5
                      </div>
                    </div>
                    ${feedback ? `
                      <p style="margin: 0; font-size: 13px; color: #4b5563; line-height: 1.5; padding: 10px 12px; border-left: 3px solid ${scoreColor};">
                        ${feedback}
                      </p>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          ${assessment.ai_feedback && assessment.ai_feedback.trim() ? `
            <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1px solid #bfdbfe; border-radius: 12px; padding: 30px; margin-bottom: 40px;">
              <h2 style="margin: 0 0 18px 0; font-size: 20px; font-weight: 600; color: #1991bd;">Overall Assessment Feedback</h2>
              <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #1991bd; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <p style="margin: 0; color: #374151; line-height: 1.7; font-size: 15px;">${assessment.ai_feedback.trim()}</p>
              </div>
            </div>
          ` : ''}
        `}

        ${isNewCEFRAssessment ? `
          <!-- CEFR Scoring Guide -->
          <div style="background: #fffbeb; border: 1px solid #fed7aa; border-radius: 12px; padding: 25px; margin-bottom: 35px;">
            <h3 style="margin: 0 0 20px 0; font-size: 16px; font-weight: 600; color: #92400e; text-align: center;">CEFR Proficiency Levels</h3>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; text-align: center;">
              <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; border: 1px solid #bbf7d0;">
                <div style="font-weight: 600; color: #16a34a; margin-bottom: 4px;">C2-C1</div>
                <div style="font-size: 11px; color: #14532d;">Advanced/Mastery</div>
              </div>
              <div style="background: #fefce8; padding: 15px; border-radius: 8px; border: 1px solid #fde68a;">
                <div style="font-weight: 600; color: #d97706; margin-bottom: 4px;">B2-B1</div>
                <div style="font-size: 11px; color: #92400e;">Independent User</div>
              </div>
              <div style="background: #fef2f2; padding: 15px; border-radius: 8px; border: 1px solid #fecaca;">
                <div style="font-weight: 600; color: #dc2626; margin-bottom: 4px;">A2-A1</div>
                <div style="font-size: 11px; color: #7f1d1d;">Basic User</div>
              </div>
            </div>
          </div>
        ` : `
          <!-- Competency Scoring Guide -->
          <div style="background: #fffbeb; border: 1px solid #fed7aa; border-radius: 12px; padding: 25px; margin-bottom: 35px;">
            <h3 style="margin: 0 0 20px 0; font-size: 16px; font-weight: 600; color: #92400e; text-align: center;">Competency Scoring Guide</h3>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; text-align: center;">
              <div style="background: #fef2f2; padding: 15px; border-radius: 8px; border: 1px solid #fecaca;">
                <div style="font-weight: 600; color: #dc2626; margin-bottom: 4px;">Red (1-2.9)</div>
                <div style="font-size: 11px; color: #7f1d1d;">Needs Improvement</div>
              </div>
              <div style="background: #fefce8; padding: 15px; border-radius: 8px; border: 1px solid #fde68a;">
                <div style="font-weight: 600; color: #d97706; margin-bottom: 4px;">Amber (3-3.9)</div>
                <div style="font-size: 11px; color: #92400e;">Good Performance</div>
              </div>
              <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; border: 1px solid #bbf7d0;">
                <div style="font-weight: 600; color: #16a34a; margin-bottom: 4px;">Green (4-5)</div>
                <div style="font-size: 11px; color: #14532d;">Excellent</div>
              </div>
            </div>
          </div>
        `}
      </div>

      <!-- Footer -->
      <div style="position: absolute; bottom: 0; left: 0; right: 0; background: #f8fafc; border-top: 2px solid #1991bd; padding: 20px 30px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #1991bd;">MediaMint Voice Assessment Tool</p>
            <p style="margin: 0 0 2px 0; font-size: 12px; color: #6b7280;">
              AI-powered communications evaluation platform ${isNewCEFRAssessment ? '(CEFR Framework)' : '(Competency System)'}
            </p>
            <p style="margin: 0; font-size: 10px; color: #9ca3af; font-style: italic;">Evaluated and generated by AI</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">
              Generated on ${new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
            <p style="margin: 0; font-size: 11px; color: #1991bd; font-weight: 500;">
              www.mediamint.com/careers
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}