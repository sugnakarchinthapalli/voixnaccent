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
      scale: 3, // Higher scale for better quality
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: container.offsetWidth,
      height: container.offsetHeight,
      logging: false,
      imageTimeout: 15000,
      removeContainer: true
    });
    
    // Remove from DOM
    document.body.removeChild(container);
    
    // Create PDF with high quality
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210; // A4 width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    // Add the canvas as image to PDF
    const imgData = canvas.toDataURL('image/png', 1.0);
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
    <div style="width: 794px; min-height: 1123px; background: white; position: relative; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <!-- Header Section -->
      <div style="background: linear-gradient(135deg, #1991bd 0%, #1991bd 100%); color: white; padding: 30px 40px; margin: 0; position: relative; overflow: hidden;">
        <div style="position: absolute; top: -20px; right: -20px; width: 100px; height: 100px; background: rgba(255,255,255,0.1); border-radius: 50%; opacity: 0.3;"></div>
        <div style="position: absolute; bottom: -30px; left: -30px; width: 80px; height: 80px; background: rgba(255,255,255,0.08); border-radius: 50%; opacity: 0.4;"></div>
        <div style="display: flex; align-items: center; justify-content: space-between; position: relative; z-index: 2;">
          <div>
            <h1 style="margin: 0; font-size: 36px; font-weight: 700; letter-spacing: -0.5px; color: white;">MediaMint</h1>
            <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9; font-weight: 400;">Voice Assessment Report</p>
            <div style="width: 60px; height: 3px; background: #1991bd; margin-top: 12px; border-radius: 2px; opacity: 0.8;"></div>
          </div>
          <div style="text-align: right;">
            <div style="background: ${gradeColor}; color: white; padding: 12px 24px; border-radius: 25px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 3px solid rgba(255,255,255,0.2);">
              ${gradeLabel} Grade
            </div>
            <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.8; font-weight: 500;">Overall Score: ${overallScore}/5.0</p>
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div style="padding: 40px 40px 100px 40px;">
        <!-- Candidate Information Card -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 30px; margin-bottom: 35px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: #1e40af; display: flex; align-items: center;">
            <span style="display: inline-block; width: 8px; height: 8px; background: #1991bd; border-radius: 50%; margin-right: 12px;"></span>
            Candidate Information
          </h2>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 25px;">
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

        <!-- Overall Assessment Card -->
        <div style="text-align: center; margin-bottom: 40px;">
          <h2 style="margin: 0 0 30px 0; font-size: 24px; font-weight: 600; color: #111827;">Overall Assessment</h2>
          <div style="display: inline-block; background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); padding: 35px 45px; border-radius: 20px; border: 2px solid #e5e7eb; box-shadow: 0 4px 12px rgba(0,0,0,0.08); position: relative; overflow: hidden;">
            <div style="position: absolute; top: -20px; left: -20px; width: 80px; height: 80px; background: ${gradeColor}; opacity: 0.1; border-radius: 50%;"></div>
            <div style="display: flex; align-items: center; justify-content: center; gap: 25px; position: relative; z-index: 2;">
              <div style="text-align: center;">
                <div style="font-size: 64px; font-weight: 700; color: #111827; line-height: 1; margin-bottom: 8px;">${overallScore}</div>
                <div style="font-size: 14px; color: #6b7280; font-weight: 500;">Out of 5.0</div>
              </div>
              <div style="width: 40px; height: 40px; border-radius: 50%; background: ${gradeColor}; box-shadow: 0 3px 10px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center;">
                <div style="width: 20px; height: 20px; background: white; border-radius: 50%; opacity: 0.3;"></div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 22px; font-weight: 600; color: #111827; margin-bottom: 4px;">Grade</div>
                <div style="font-size: 18px; font-weight: 700; color: ${gradeColor};">${gradeLabel}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Competency Breakdown -->
        <div style="margin-bottom: 40px;">
          <h2 style="margin: 0 0 30px 0; font-size: 22px; font-weight: 600; color: #111827; text-align: center;">Competency Breakdown</h2>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 25px;">
            ${Object.entries(competencyLabels).map(([key, label]) => {
              const score = assessment.assessment_scores?.[key as keyof typeof competencyLabels] || 0;
              const feedback = assessment.assessment_scores?.feedback?.[key as keyof typeof competencyLabels] || '';
              const scoreColor = getGradeColor(score);
              const scoreBg = score >= 4 ? '#ecfdf5' : score >= 3 ? '#fefce8' : '#fef2f2';
              
              return `
                <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 25px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); position: relative; overflow: hidden;">
                  <div style="position: absolute; top: 0; right: 0; width: 40px; height: 40px; background: ${scoreBg}; opacity: 0.5; border-radius: 0 12px 0 40px;"></div>
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; position: relative; z-index: 2;">
                    <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #111827;">${label}</h3>
                    <div style="background: ${scoreColor}; color: white; padding: 8px 14px; border-radius: 15px; font-size: 14px; font-weight: 700; min-width: 50px; text-align: center; box-shadow: 0 2px 6px rgba(0,0,0,0.15);">
                      ${score}/5
                    </div>
                  </div>
                  ${feedback ? `
                    <p style="margin: 0; font-size: 13px; color: #4b5563; line-height: 1.6; position: relative; z-index: 2; padding: 12px 15px; border-left: 3px solid ${scoreColor}; background: ${scoreBg}; border-radius: 6px; margin-top: 10px;">
                      ${feedback}
                    </p>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- AI Feedback Section -->
        ${assessment.ai_feedback ? `
          <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1px solid #bfdbfe; border-radius: 12px; padding: 30px; margin-bottom: 40px; position: relative; overflow: hidden;">
            <div style="position: absolute; top: -15px; right: -15px; width: 80px; height: 80px; background: rgba(25, 145, 189, 0.1); border-radius: 50%;"></div>
            <div style="position: absolute; bottom: -10px; left: -10px; width: 60px; height: 60px; background: rgba(25, 145, 189, 0.08); border-radius: 50%;"></div>
            <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: #1991bd; position: relative; z-index: 2;">Overall Assessment Feedback</h2>
            <div style="background: white; padding: 25px; border-radius: 8px; border-left: 4px solid #1991bd; box-shadow: 0 2px 4px rgba(0,0,0,0.1); position: relative; z-index: 2;">
              <p style="margin: 0; color: #374151; line-height: 1.7; font-size: 15px;">${assessment.ai_feedback}</p>
            </div>
          </div>
        ` : ''}

        <!-- Performance Summary -->
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 30px; margin-bottom: 35px;">
          <h2 style="margin: 0 0 25px 0; font-size: 20px; font-weight: 600; color: #111827; text-align: center;">Performance Summary</h2>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center;">
            <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
              <div style="font-size: 24px; font-weight: 700; color: #10b981; margin-bottom: 4px;">
                ${Object.values(assessment.assessment_scores || {}).filter((score: any) => typeof score === 'number' && score >= 4).length}
              </div>
              <div style="font-size: 12px; color: #6b7280; font-weight: 500;">Green Scores</div>
            </div>
            <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
              <div style="font-size: 24px; font-weight: 700; color: #f59e0b; margin-bottom: 4px;">
                ${Object.values(assessment.assessment_scores || {}).filter((score: any) => typeof score === 'number' && score >= 3 && score < 4).length}
              </div>
              <div style="font-size: 12px; color: #6b7280; font-weight: 500;">Amber Scores</div>
            </div>
            <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
              <div style="font-size: 24px; font-weight: 700; color: #ef4444; margin-bottom: 4px;">
                ${Object.values(assessment.assessment_scores || {}).filter((score: any) => typeof score === 'number' && score < 3).length}
              </div>
              <div style="font-size: 12px; color: #6b7280; font-weight: 500;">Red Scores</div>
            </div>
          </div>
        </div>

        <!-- Scoring Guide -->
        <div style="background: #fffbeb; border: 1px solid #fed7aa; border-radius: 12px; padding: 25px; margin-bottom: 35px;">
          <h3 style="margin: 0 0 20px 0; font-size: 16px; font-weight: 600; color: #92400e; text-align: center;">Scoring Guide</h3>
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
      </div>

      <!-- Footer -->
      <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-top: 2px solid #1991bd; padding: 25px 40px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #1991bd;">MediaMint Voice Assessment Tool</p>
            <p style="margin: 0 0 2px 0; font-size: 12px; color: #6b7280;">AI-powered communications evaluation platform</p>
            <p style="margin: 0; font-size: 9px; color: #9ca3af; font-style: italic;">Evaluated and generated by AI</p>
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