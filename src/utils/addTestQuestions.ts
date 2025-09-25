import { questionService } from '../services/questionService';

export async function addTestQuestions() {
  const testQuestions = [
    {
      text: "Describe your ideal work environment and explain how it helps you be more productive and motivated in your daily tasks.",
      difficulty_level: 'medium' as const,
      is_active: true
    },
    {
      text: "Tell me about a challenging situation you faced recently and how you handled it. What did you learn from this experience?",
      difficulty_level: 'medium' as const,
      is_active: true
    },
    {
      text: "If you could travel anywhere in the world for work, where would you go and what type of project would you want to work on there?",
      difficulty_level: 'easy' as const,
      is_active: true
    },
    {
      text: "Explain a complex technical concept or process from your field in simple terms that anyone could understand.",
      difficulty_level: 'hard' as const,
      is_active: true
    },
    {
      text: "Discuss the impact of artificial intelligence on your industry and how professionals should adapt to these changes.",
      difficulty_level: 'hard' as const,
      is_active: true
    }
  ];

  console.log('🚀 Adding test questions to database...');
  
  for (let i = 0; i < testQuestions.length; i++) {
    const question = testQuestions[i];
    try {
      console.log(`➡️  Adding question ${i + 1}/${testQuestions.length}`);
      const created = await questionService.createQuestion(question);
      console.log(`✅ Created question with ID: ${created.id}`);
    } catch (error) {
      console.error(`❌ Failed to create question ${i + 1}:`, error);
    }
  }
  
  console.log('🎉 Finished adding test questions');
}
