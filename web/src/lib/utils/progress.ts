/**
 * Progress Calculation Utilities
 * 
 * Utilities for calculating course progress, lesson completion tracking,
 * enrollment statistics, and progress visualization data generation.
 * 
 * Requirements: 9.5
 */

import { memoize } from './performance';

// =============================================================================
// Types and Interfaces
// =============================================================================

export interface CourseProgress {
  courseId: string;
  totalLessons: number;
  completedLessons: number;
  totalDuration: number; // in milliseconds
  completedDuration: number; // in milliseconds
  progressPercentage: number;
  estimatedTimeRemaining: number; // in milliseconds
  lastActivityDate: Date;
  completionDate?: Date;
  certificateEarned: boolean;
}

export interface LessonProgress {
  lessonId: string;
  courseId: string;
  isCompleted: boolean;
  completionPercentage: number;
  timeSpent: number; // in milliseconds
  lastAccessDate: Date;
  completionDate?: Date;
  watchTime?: number; // for video lessons, in milliseconds
  videoDuration?: number; // total video duration, in milliseconds
}

export interface ModuleProgress {
  moduleId: string;
  courseId: string;
  totalLessons: number;
  completedLessons: number;
  progressPercentage: number;
  lessons: LessonProgress[];
  isCompleted: boolean;
  completionDate?: Date;
}

export interface EnrollmentStatistics {
  totalEnrollments: number;
  activeEnrollments: number;
  completedEnrollments: number;
  averageCompletionTime: number; // in milliseconds
  averageProgressPercentage: number;
  completionRate: number; // percentage
  dropoffPoints: Array<{
    lessonId: string;
    lessonTitle: string;
    dropoffRate: number;
  }>;
  engagementMetrics: {
    averageSessionDuration: number;
    averageSessionsPerWeek: number;
    mostActiveTimeOfDay: number; // hour of day (0-23)
    mostActiveDayOfWeek: number; // day of week (0-6, Sunday = 0)
  };
}

export interface ProgressVisualizationData {
  dailyProgress: Array<{
    date: string;
    lessonsCompleted: number;
    timeSpent: number;
    progressGained: number;
  }>;
  weeklyProgress: Array<{
    week: string;
    lessonsCompleted: number;
    timeSpent: number;
    progressGained: number;
  }>;
  monthlyProgress: Array<{
    month: string;
    lessonsCompleted: number;
    timeSpent: number;
    progressGained: number;
  }>;
  streakData: {
    currentStreak: number;
    longestStreak: number;
    streakDates: string[];
  };
}

export interface Course {
  id: string;
  title: string;
  modules: Module[];
  totalDuration?: number;
}

export interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
  order: number;
}

export interface Lesson {
  id: string;
  title: string;
  duration?: number; // in milliseconds
  type: 'video' | 'text' | 'quiz' | 'assignment';
  order: number;
}

export interface Enrollment {
  id: string;
  courseId: string;
  studentId: string;
  enrolledAt: Date;
  completedAt?: Date;
  lastAccessDate: Date;
  progressPercentage: number;
  lessonProgress: LessonProgress[];
}

// =============================================================================
// Course Progress Calculations
// =============================================================================

/**
 * Calculates overall course progress for a student
 */
export const calculateCourseProgress = memoize((
  course: Course,
  enrollment: Enrollment
): CourseProgress => {
  const allLessons = course.modules.flatMap(module => module.lessons);
  const totalLessons = allLessons.length;
  
  const completedLessons = enrollment.lessonProgress.filter(
    progress => progress.isCompleted
  ).length;

  const totalDuration = course.totalDuration || allLessons.reduce(
    (sum, lesson) => sum + (lesson.duration || 0), 0
  );

  const completedDuration = enrollment.lessonProgress
    .filter(progress => progress.isCompleted)
    .reduce((sum, progress) => {
      const lesson = allLessons.find(l => l.id === progress.lessonId);
      return sum + (lesson?.duration || 0);
    }, 0);

  const progressPercentage = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

  // Estimate time remaining based on average completion time
  const averageTimePerLesson = completedLessons > 0 
    ? completedDuration / completedLessons 
    : totalDuration / totalLessons;
  
  const remainingLessons = totalLessons - completedLessons;
  const estimatedTimeRemaining = remainingLessons * averageTimePerLesson;

  const isCompleted = completedLessons === totalLessons;
  const certificateEarned = isCompleted && progressPercentage >= 100;

  return {
    courseId: course.id,
    totalLessons,
    completedLessons,
    totalDuration,
    completedDuration,
    progressPercentage: Math.round(progressPercentage * 100) / 100, // Round to 2 decimal places
    estimatedTimeRemaining,
    lastActivityDate: enrollment.lastAccessDate,
    ...(enrollment.completedAt && { completionDate: enrollment.completedAt }),
    certificateEarned,
  };
});

/**
 * Calculates progress for a specific module
 */
export const calculateModuleProgress = memoize((
  module: Module,
  lessonProgressList: LessonProgress[]
): ModuleProgress => {
  const moduleLessons = module.lessons;
  const totalLessons = moduleLessons.length;

  const moduleLessonProgress = lessonProgressList.filter(
    progress => moduleLessons.some(lesson => lesson.id === progress.lessonId)
  );

  const completedLessons = moduleLessonProgress.filter(
    progress => progress.isCompleted
  ).length;

  const progressPercentage = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
  const isCompleted = completedLessons === totalLessons;

  // Find completion date (when last lesson was completed)
  const completionDate = isCompleted 
    ? moduleLessonProgress
        .filter(p => p.isCompleted && p.completionDate)
        .sort((a, b) => (b.completionDate!.getTime() - a.completionDate!.getTime()))[0]?.completionDate
    : undefined;

  return {
    moduleId: module.id,
    courseId: '', // Will be set by caller
    totalLessons,
    completedLessons,
    progressPercentage: Math.round(progressPercentage * 100) / 100,
    lessons: moduleLessonProgress,
    isCompleted,
    ...(completionDate && { completionDate }),
  };
});

/**
 * Calculates lesson completion percentage for video lessons
 */
export const calculateLessonCompletionPercentage = (
  watchTime: number,
  videoDuration: number,
  completionThreshold: number = 0.8 // 80% watched = completed
): number => {
  if (videoDuration <= 0) return 0;
  
  const percentage = Math.min((watchTime / videoDuration) * 100, 100);
  return Math.round(percentage * 100) / 100;
};

/**
 * Determines if a lesson should be marked as completed
 */
export const isLessonCompleted = (
  lesson: Lesson,
  progress: LessonProgress,
  completionThreshold: number = 0.8
): boolean => {
  switch (lesson.type) {
    case 'video':
      if (!progress.watchTime || !progress.videoDuration) return false;
      return progress.watchTime >= (progress.videoDuration * completionThreshold);
    
    case 'text':
      // Text lessons are completed when accessed for minimum time
      const minimumReadTime = (lesson.duration || 60000) * 0.5; // 50% of estimated read time
      return progress.timeSpent >= minimumReadTime;
    
    case 'quiz':
    case 'assignment':
      // These are completed when explicitly marked as completed
      return progress.isCompleted;
    
    default:
      return progress.isCompleted;
  }
};

// =============================================================================
// Enrollment Statistics
// =============================================================================

/**
 * Calculates comprehensive enrollment statistics for a course
 */
export const calculateEnrollmentStatistics = memoize((
  enrollments: Enrollment[],
  course: Course
): EnrollmentStatistics => {
  const totalEnrollments = enrollments.length;
  const completedEnrollments = enrollments.filter(e => e.completedAt).length;
  const activeEnrollments = enrollments.filter(e => !e.completedAt).length;

  // Calculate completion rate
  const completionRate = totalEnrollments > 0 ? (completedEnrollments / totalEnrollments) * 100 : 0;

  // Calculate average completion time
  const completedEnrollmentsWithTime = enrollments.filter(e => e.completedAt && e.enrolledAt);
  const averageCompletionTime = completedEnrollmentsWithTime.length > 0
    ? completedEnrollmentsWithTime.reduce((sum, e) => {
        return sum + (e.completedAt!.getTime() - e.enrolledAt.getTime());
      }, 0) / completedEnrollmentsWithTime.length
    : 0;

  // Calculate average progress percentage
  const averageProgressPercentage = totalEnrollments > 0
    ? enrollments.reduce((sum, e) => sum + e.progressPercentage, 0) / totalEnrollments
    : 0;

  // Calculate dropoff points
  const allLessons = course.modules.flatMap(module => module.lessons);
  const dropoffPoints = allLessons.map(lesson => {
    const studentsWhoReachedLesson = enrollments.filter(enrollment => {
      const lessonProgress = enrollment.lessonProgress.find(p => p.lessonId === lesson.id);
      return lessonProgress && lessonProgress.lastAccessDate;
    }).length;

    const studentsWhoCompletedLesson = enrollments.filter(enrollment => {
      const lessonProgress = enrollment.lessonProgress.find(p => p.lessonId === lesson.id);
      return lessonProgress && lessonProgress.isCompleted;
    }).length;

    const dropoffRate = studentsWhoReachedLesson > 0 
      ? ((studentsWhoReachedLesson - studentsWhoCompletedLesson) / studentsWhoReachedLesson) * 100
      : 0;

    return {
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      dropoffRate: Math.round(dropoffRate * 100) / 100,
    };
  }).sort((a, b) => b.dropoffRate - a.dropoffRate);

  // Calculate engagement metrics
  const engagementMetrics = calculateEngagementMetrics(enrollments);

  return {
    totalEnrollments,
    activeEnrollments,
    completedEnrollments,
    averageCompletionTime,
    averageProgressPercentage: Math.round(averageProgressPercentage * 100) / 100,
    completionRate: Math.round(completionRate * 100) / 100,
    dropoffPoints,
    engagementMetrics,
  };
});

/**
 * Calculates engagement metrics from enrollment data
 */
const calculateEngagementMetrics = (enrollments: Enrollment[]) => {
  const allSessions = enrollments.flatMap(enrollment => 
    enrollment.lessonProgress.map(progress => ({
      date: progress.lastAccessDate,
      duration: progress.timeSpent,
    }))
  );

  // Calculate average session duration
  const averageSessionDuration = allSessions.length > 0
    ? allSessions.reduce((sum, session) => sum + session.duration, 0) / allSessions.length
    : 0;

  // Calculate sessions per week (simplified)
  const averageSessionsPerWeek = allSessions.length > 0 ? allSessions.length / 4 : 0; // Assuming 4 weeks of data

  // Find most active time of day
  const hourCounts = new Array(24).fill(0);
  allSessions.forEach(session => {
    const hour = session.date.getHours();
    hourCounts[hour]++;
  });
  const mostActiveTimeOfDay = hourCounts.indexOf(Math.max(...hourCounts));

  // Find most active day of week
  const dayCounts = new Array(7).fill(0);
  allSessions.forEach(session => {
    const day = session.date.getDay();
    dayCounts[day]++;
  });
  const mostActiveDayOfWeek = dayCounts.indexOf(Math.max(...dayCounts));

  return {
    averageSessionDuration,
    averageSessionsPerWeek,
    mostActiveTimeOfDay,
    mostActiveDayOfWeek,
  };
};

// =============================================================================
// Progress Visualization Data
// =============================================================================

/**
 * Generates data for progress visualization charts
 */
export const generateProgressVisualizationData = memoize((
  enrollment: Enrollment,
  dateRange: { start: Date; end: Date }
): ProgressVisualizationData => {
  const { start, end } = dateRange;
  
  // Generate daily progress data
  const dailyProgress = generateDailyProgressData(enrollment, start, end);
  
  // Generate weekly progress data
  const weeklyProgress = generateWeeklyProgressData(dailyProgress);
  
  // Generate monthly progress data
  const monthlyProgress = generateMonthlyProgressData(dailyProgress);
  
  // Calculate streak data
  const streakData = calculateStreakData(dailyProgress);

  return {
    dailyProgress,
    weeklyProgress,
    monthlyProgress,
    streakData,
  };
});

/**
 * Generates daily progress data
 */
const generateDailyProgressData = (
  enrollment: Enrollment,
  start: Date,
  end: Date
) => {
  const dailyData: Array<{
    date: string;
    lessonsCompleted: number;
    timeSpent: number;
    progressGained: number;
  }> = [];

  const currentDate = new Date(start);
  
  while (currentDate <= end) {
    const dateStr = currentDate.toISOString().split('T')[0];
    
    // Find lessons completed on this date
    const lessonsCompletedToday = enrollment.lessonProgress.filter(progress => {
      if (!progress.completionDate) return false;
      const completionDateStr = progress.completionDate.toISOString().split('T')[0];
      return completionDateStr === dateStr;
    });

    const lessonsCompleted = lessonsCompletedToday.length;
    const timeSpent = lessonsCompletedToday.reduce((sum, progress) => sum + progress.timeSpent, 0);
    
    // Calculate progress gained (simplified as lessons completed / total lessons * 100)
    const progressGained = lessonsCompleted; // This would need total lesson count for accurate percentage

    dailyData.push({
      date: dateStr,
      lessonsCompleted,
      timeSpent,
      progressGained,
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dailyData;
};

/**
 * Generates weekly progress data from daily data
 */
const generateWeeklyProgressData = (dailyData: any[]) => {
  const weeklyData: any[] = [];
  
  for (let i = 0; i < dailyData.length; i += 7) {
    const weekData = dailyData.slice(i, i + 7);
    const weekStart = new Date(weekData[0].date);
    const weekStr = `${weekStart.getFullYear()}-W${Math.ceil((weekStart.getTime() - new Date(weekStart.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))}`;
    
    const lessonsCompleted = weekData.reduce((sum, day) => sum + day.lessonsCompleted, 0);
    const timeSpent = weekData.reduce((sum, day) => sum + day.timeSpent, 0);
    const progressGained = weekData.reduce((sum, day) => sum + day.progressGained, 0);

    weeklyData.push({
      week: weekStr,
      lessonsCompleted,
      timeSpent,
      progressGained,
    });
  }

  return weeklyData;
};

/**
 * Generates monthly progress data from daily data
 */
const generateMonthlyProgressData = (dailyData: any[]) => {
  const monthlyMap = new Map<string, any>();

  dailyData.forEach(day => {
    const date = new Date(day.date);
    const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!monthlyMap.has(monthStr)) {
      monthlyMap.set(monthStr, {
        month: monthStr,
        lessonsCompleted: 0,
        timeSpent: 0,
        progressGained: 0,
      });
    }

    const monthData = monthlyMap.get(monthStr)!;
    monthData.lessonsCompleted += day.lessonsCompleted;
    monthData.timeSpent += day.timeSpent;
    monthData.progressGained += day.progressGained;
  });

  return Array.from(monthlyMap.values());
};

/**
 * Calculates streak data from daily progress
 */
const calculateStreakData = (dailyData: any[]) => {
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  const streakDates: string[] = [];

  // Calculate streaks (days with any progress)
  for (let i = dailyData.length - 1; i >= 0; i--) {
    const day = dailyData[i];
    
    if (day.lessonsCompleted > 0 || day.timeSpent > 0) {
      tempStreak++;
      if (i === dailyData.length - 1 || currentStreak === 0) {
        currentStreak = tempStreak;
      }
      streakDates.unshift(day.date);
    } else {
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
      tempStreak = 0;
      if (currentStreak > 0) {
        currentStreak = 0;
      }
    }
  }

  if (tempStreak > longestStreak) {
    longestStreak = tempStreak;
  }

  return {
    currentStreak,
    longestStreak,
    streakDates: streakDates.slice(-currentStreak), // Only current streak dates
  };
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Calculates the next lesson a student should take
 */
export const getNextLesson = (
  course: Course,
  enrollment: Enrollment
): Lesson | null => {
  for (const module of course.modules.sort((a, b) => a.order - b.order)) {
    for (const lesson of module.lessons.sort((a, b) => a.order - b.order)) {
      const progress = enrollment.lessonProgress.find(p => p.lessonId === lesson.id);
      
      if (!progress || !progress.isCompleted) {
        return lesson;
      }
    }
  }
  
  return null; // All lessons completed
};

/**
 * Calculates estimated completion date based on current progress
 */
export const estimateCompletionDate = (
  courseProgress: CourseProgress,
  averageLessonsPerWeek: number = 3
): Date | null => {
  if (courseProgress.completedLessons === courseProgress.totalLessons) {
    return courseProgress.completionDate || null;
  }

  const remainingLessons = courseProgress.totalLessons - courseProgress.completedLessons;
  const weeksRemaining = remainingLessons / averageLessonsPerWeek;
  const millisecondsRemaining = weeksRemaining * 7 * 24 * 60 * 60 * 1000;

  const estimatedDate = new Date(Date.now() + millisecondsRemaining);
  return estimatedDate;
};

// =============================================================================
// Exports
// =============================================================================

export const ProgressCalculators = {
  calculateCourseProgress,
  calculateModuleProgress,
  calculateLessonCompletionPercentage,
  isLessonCompleted,
  calculateEnrollmentStatistics,
  generateProgressVisualizationData,
  getNextLesson,
  estimateCompletionDate,
};