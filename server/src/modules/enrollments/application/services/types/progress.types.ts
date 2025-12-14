/**
 * Type definitions for Progress Calculator Service
 */

export interface LessonProgressRecord {
  id: string;
  enrollmentId: string;
  lessonId: string;
  status: 'not_started' | 'in_progress' | 'completed';
  timeSpentSeconds: number;
  completedAt?: Date | null;
  quizScore?: number | null;
  attemptsCount: number;
  lastAccessedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LessonData {
  id: string;
  title: string;
  moduleId: string;
  lessonType: 'video' | 'text' | 'quiz' | 'assignment';
  durationMinutes?: number | null;
  orderNumber: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProgressAnalysisData {
  progressRecords: LessonProgressRecord[];
  lessons: LessonData[];
}

export interface LessonTypeMultipliers {
  video: number;
  text: number;
  quiz: number;
  assignment: number;
}

export interface DefaultLessonDurations {
  video: number;
  text: number;
  quiz: number;
  assignment: number;
}

export interface CompletedLessonRecord {
  id: string;
  enrollmentId: string;
  lessonId: string;
  status: 'completed';
  timeSpentSeconds: number;
  completedAt: Date;
  quizScore?: number | null;
  attemptsCount: number;
  lastAccessedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}