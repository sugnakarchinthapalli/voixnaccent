import { supabase } from '../lib/supabase';
import { Question } from '../types';

export class QuestionService {
  async getRandomQuestion(): Promise<Question> {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching questions:', error);
      throw new Error('Failed to fetch assessment questions');
    }

    if (!data || data.length === 0) {
      throw new Error('No active questions available');
    }

    // Select a random question
    const randomIndex = Math.floor(Math.random() * data.length);
    return data[randomIndex];
  }

  async getAllQuestions(): Promise<Question[]> {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async createQuestion(questionData: {
    text: string;
    difficulty_level?: 'easy' | 'medium' | 'hard';
    is_active?: boolean;
  }): Promise<Question> {
    const { data, error } = await supabase
      .from('questions')
      .insert({
        text: questionData.text,
        difficulty_level: questionData.difficulty_level || 'medium',
        is_active: questionData.is_active !== false
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateQuestion(id: string, updates: Partial<Question>): Promise<Question> {
    const { data, error } = await supabase
      .from('questions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteQuestion(id: string): Promise<void> {
    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}

export const questionService = new QuestionService();