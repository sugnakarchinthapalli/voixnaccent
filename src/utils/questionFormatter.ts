/**
 * Utility function to format assessment question text with proper HTML formatting
 * Converts plain text questions into properly formatted HTML with line breaks, bold text, etc.
 */

export function formatQuestionText(text: string): string {
  if (!text) return '';
  
  // Check if this looks like one of our structured case studies
  if (text.includes('Kurzfallstudie:') || text.includes('Étude de Cas Condensée :')) {
    return formatCaseStudyText(text);
  }
  
  // For other questions, use simple formatting
  return formatQuestionTextSimple(text);
}

/**
 * Format structured case study questions
 */
function formatCaseStudyText(text: string): string {
  // Split the content into case study and questions
  const questionStartPattern = /(Was war die größte Herausforderung|Quel était le défi le plus important)/;
  const match = text.match(questionStartPattern);
  
  if (match) {
    const splitIndex = text.indexOf(match[0]);
    const caseStudy = text.substring(0, splitIndex).trim();
    const questions = text.substring(splitIndex).trim();
    
    const formattedCaseStudy = formatCaseStudySection(caseStudy);
    const formattedQuestions = formatQuestionsSection(questions);
    
    return formattedCaseStudy + '<div class="mt-8 pt-6 border-t-2 border-gray-300">' + formattedQuestions + '</div>';
  }
  
  // If no questions section found, just format as case study
  return formatCaseStudySection(text);
}

function formatCaseStudySection(text: string): string {
  return text
    // Language headers
    .replace(/(Deutsch \(German\) 🇩🇪|Französisch \(French\) 🇫🇷)/g, '<div class="text-xl font-bold text-blue-900 mb-4 border-b-2 border-blue-200 pb-2">$1</div>')
    
    // Main title
    .replace(/^(Kurzfallstudie:|Étude de Cas Condensée :)(.*?)$/gm, '<h2 class="text-lg font-bold text-gray-900 mt-6 mb-4 bg-blue-50 p-3 rounded-lg">$1$2</h2>')
    
    // Section headers
    .replace(/^(Der Kunde und die Agentur|Le Client et l\'Agence)$/gm, '<h3 class="text-base font-semibold text-blue-800 mt-5 mb-3 border-l-4 border-blue-400 pl-3">$1</h3>')
    .replace(/^(Die Herausforderung|Le Défi)$/gm, '<h3 class="text-base font-semibold text-red-800 mt-5 mb-3 border-l-4 border-red-400 pl-3">$1</h3>')
    .replace(/^(Die Lösung|La Solution) \((.*?)\)$/gm, '<h3 class="text-base font-semibold text-green-800 mt-5 mb-3 border-l-4 border-green-400 pl-3">$1 <span class="text-sm font-normal text-gray-600">($2)</span></h3>')
    .replace(/^(Ergebnis|Résultat)$/gm, '<h3 class="text-base font-semibold text-purple-800 mt-5 mb-3 border-l-4 border-purple-400 pl-3">$1</h3>')
    
    // Key-value pairs
    .replace(/^(Agentur|Agence):/gm, '<div class="mb-2"><strong class="text-blue-700">$1:</strong>')
    .replace(/^(Kunde|Client):/gm, '<div class="mb-2"><strong class="text-green-700">$1:</strong>')
    .replace(/^(Ziel|Objectif):/gm, '<div class="mb-2"><strong class="text-purple-700">$1:</strong>')
    
    // Challenge items
    .replace(/^(Nischenzielgruppe|Public de Niche):/gm, '<div class="mb-2 ml-4"><strong class="text-red-700">• $1:</strong>')
    .replace(/^(Fehlende Kreative|Absence de Créatifs):/gm, '<div class="mb-2 ml-4"><strong class="text-red-700">• $1:</strong>')
    
    // Solution items
    .replace(/^(Kostenlose Kreativleistungen|Création Gratuite):/gm, '<div class="mb-2 ml-4"><strong class="text-green-700">• $1:</strong>')
    .replace(/^(Targeting|Ciblage):/gm, '<div class="mb-2 ml-4"><strong class="text-green-700">• $1:</strong>')
    .replace(/^(Kontoeinrichtung|Configuration du Compte):/gm, '<div class="mb-2 ml-4"><strong class="text-green-700">• $1:</strong>')
    .replace(/^(Planungshilfe|Planification):/gm, '<div class="mb-2 ml-4"><strong class="text-green-700">• $1:</strong>')
    
    // Company names
    .replace(/(Apex Media)/g, '<span class="font-semibold text-blue-800 bg-blue-100 px-1 rounded">$1</span>')
    .replace(/(FinSmart)/g, '<span class="font-semibold text-green-800 bg-green-100 px-1 rounded">$1</span>')
    .replace(/(Spotify)/g, '<span class="font-semibold text-purple-800 bg-purple-100 px-1 rounded">$1</span>')
    
    // People names
    .replace(/(Elias Vance|Anya Sharma)/g, '<span class="font-medium text-gray-800 bg-gray-100 px-1 rounded">$1</span>')
    
    // Currency
    .replace(/\$([0-9,]+)/g, '<span class="font-mono font-semibold text-green-600 bg-green-50 px-1 rounded">$$$1</span>')
    
    // Time periods
    .replace(/([0-9]+)\s*bis\s*([0-9]+)\s*(Stunden|heures)/g, '<span class="font-medium text-orange-600 bg-orange-50 px-1 rounded">$1 bis $2 $3</span>')
    
    // Age ranges
    .replace(/([0-9]+)–([0-9]+)/g, '<span class="font-medium text-orange-600 bg-orange-50 px-1 rounded">$1–$2</span>')
    
    // Parenthetical information
    .replace(/\(([^)]+)\)/g, '<span class="text-gray-600 italic">($1)</span>')
    
    // Line breaks
    .replace(/\n\s*\n/g, '</div><div class="space-y-2">')
    .replace(/\n/g, '</div><div>');
    
  return '<div class="space-y-2"><div>' + text + '</div></div>';
}

function formatQuestionsSection(text: string): string {
  // Split questions by line breaks
  const questions = text.split(/\n+/).filter(q => q.trim().length > 0);
  
  return '<div class="bg-yellow-50 p-4 rounded-lg border-2 border-yellow-200">' +
    '<h3 class="text-lg font-bold text-yellow-900 mb-4">📝 Assessment Questions</h3>' +
    '<div class="space-y-4">' +
    questions.map((q, index) => 
      `<div class="bg-white p-3 rounded-lg border-l-4 border-yellow-400">
        <span class="font-semibold text-yellow-800">Question ${index + 1}:</span>
        <p class="text-gray-800 mt-1">${q.trim()}</p>
      </div>`
    ).join('') +
    '</div>' +
    '</div>';
}

/**
 * Alternative simpler formatting function for basic formatting
 */
export function formatQuestionTextSimple(text: string): string {
  if (!text) return '';
  
  return text
    // Convert line breaks to HTML
    .replace(/\n\s*\n/g, '</p><p class="mb-4">')
    .replace(/\n/g, '<br>')
    // Wrap in paragraphs
    .replace(/^/, '<p class="mb-4">')
    .replace(/$/, '</p>');
}
