import React from 'react';
import { clsx } from 'clsx';

interface ScoreBadgeProps {
  score: number;
  competency?: string;
  showScore?: boolean;
  showGradeText?: boolean;
}

export function ScoreBadge({ score, competency, showScore = true, showGradeText = false }: ScoreBadgeProps) {
  const getGradeColor = (score: number) => {
    if (score >= 4) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 3) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const getGradeLabel = (score: number) => {
    if (score >= 4) return 'Green';
    if (score >= 3) return 'Amber';
    return 'Red';
  };

  return (
    <div className={clsx(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
      getGradeColor(score)
    )}>
      {competency && <span className="mr-1">{competency}:</span>}
      {showScore && <span className="font-bold">{score}</span>}
      {showGradeText && (
        <span className={clsx('ml-1', showScore ? '' : 'font-bold')}>
          {getGradeLabel(score)}
        </span>
      )}
    </div>
  );
}