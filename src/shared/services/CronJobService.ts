/**
 * Cron Job Service
 * 
 * Manages scheduled tasks including secret rotation, analytics aggregation,
 * and maintenance tasks.
 * 
 * Requirements: 13.7, 14.7
 */

import cron from 'node-cron';
import { secretRotationService } from './SecretRotationService.js';
import { logger } from '../utils/logger.js';
import { config } from '../../config/index.js';

/**
 * Cron job configuration
 */
export interface CronJobConfig {
  /** Job name */
  name: string;
  /** Cron expression */
  schedule: string;
  /** Job function */
  task: () => Promise<void>;
  /** Whether job is enabled */
  enabled: boolean;
  /** Timezone for scheduling */
  timezone?: string;
}

/**
 * Cron Job Service
 */
export class CronJobService {
  private static instance: CronJobService;
  private jobs = new Map<string, cron.ScheduledTask>();
  private isEnabled: boolean;

  private constructor() {
    thi