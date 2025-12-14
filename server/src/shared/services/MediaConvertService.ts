/**
 * MediaConvert Service Implementation
 *
 * Implements AWS MediaConvert operations for video transcoding
 * with support for multiple resolutions and HLS streaming.
 *
 * Requirements:
 * - 4.2: MediaConvert transcoding with multiple resolutions
 * - 4.3: Transcoding job status and retry logic
 * - 4.4: Processing completion handling
 */

import {
  MediaConvertClient,
  CreateJobCommand,
  GetJobCommand,
  CancelJobCommand,
  ListJobsCommand,
  DescribeEndpointsCommand,
  Job,
  JobStatus as MediaConvertJobStatus,
  CreateJobRequest,
  JobSettings,
  OutputGroup,
  Output,
  VideoCodecSettings,
  AudioCodecSettings,
  ContainerSettings,
  HlsGroupSettings,
} from '@aws-sdk/client-mediaconvert';

import { config } from '../../config/index.js';
import { ExternalServiceError, NotFoundError, ValidationError } from '../errors/index.js';
import { logger } from '../utils/logger.js';
import { secrets } from '../utils/secureConfig.js';

import {
  IMediaConvertService,
  TranscodingJobInput,
  JobStatus,
  CreateJobResult,
  TranscodingJobOutput,
  TranscodingResolution,
  DEFAULT_TRANSCODING_RESOLUTIONS,
  HLS_JOB_TEMPLATE,
} from './IMediaConvertService.js';

/**
 * MediaConvert Service Implementation
 *
 * Provides AWS MediaConvert operations with comprehensive error handling,
 * logging, and support for adaptive bitrate streaming.
 */
export class MediaConvertService implements IMediaConvertService {
  private client: MediaConvertClient;
  private endpoint: string | null = null;

  constructor() {
    // Initialize client with basic configuration
    // Endpoint will be set dynamically after discovery
    const awsConfig = secrets.getAwsConfig();
    this.client = new MediaConvertClient({
      region: awsConfig.region,
      credentials:
        awsConfig.accessKeyId && awsConfig.secretAccessKey
          ? {
              accessKeyId: awsConfig.accessKeyId,
              secretAccessKey: awsConfig.secretAccessKey,
            }
          : undefined,
    });
  }

  /**
   * Creates a transcoding job for video processing
   */
  async createTranscodingJob(input: TranscodingJobInput): Promise<CreateJobResult> {
    try {
      logger.info('Creating MediaConvert transcoding job', {
        jobName: input.jobName,
        inputS3Key: input.inputS3Key,
        resolutionCount: input.resolutions.length,
      });

      // Validate input parameters
      this.validateJobInput(input);

      // Ensure we have the correct endpoint
      await this.ensureEndpoint();

      // Build job settings
      const jobSettings = this.buildJobSettings(input);

      // Create job request
      const createJobRequest: CreateJobRequest = {
        Role: config.mediaConvert.roleArn,
        Queue: config.mediaConvert.queueArn,
        Settings: jobSettings,
        UserMetadata: {
          ...input.metadata,
          createdBy: 'learning-platform-backend',
          inputS3Key: input.inputS3Key,
          outputS3KeyPrefix: input.outputS3KeyPrefix,
        },
        Tags: {
          Project: 'learning-platform',
          Environment: config.nodeEnv,
          InputFile: input.inputS3Key,
        },
      };

      // Execute job creation
      const command = new CreateJobCommand(createJobRequest);
      const response = await this.client.send(command);

      if (!response.Job?.Id || !response.Job?.Arn) {
        throw new ExternalServiceError(
          'MediaConvert',
          'Job creation response missing required fields',
          new Error('Invalid response from MediaConvert')
        );
      }

      const result: CreateJobResult = {
        jobId: response.Job.Id,
        jobArn: response.Job.Arn,
        status: response.Job.Status || 'SUBMITTED',
      };

      logger.info('MediaConvert job created successfully', {
        jobId: result.jobId,
        jobArn: result.jobArn,
        status: result.status,
      });

      return result;
    } catch (error) {
      logger.error('Failed to create MediaConvert job', {
        jobName: input.jobName,
        inputS3Key: input.inputS3Key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof ValidationError || error instanceof ExternalServiceError) {
        throw error;
      }

      throw new ExternalServiceError(
        'MediaConvert',
        'Failed to create transcoding job',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Gets the status of a transcoding job
   */
  async getJobStatus(jobId: string): Promise<JobStatus> {
    try {
      logger.debug('Getting MediaConvert job status', { jobId });

      await this.ensureEndpoint();

      const command = new GetJobCommand({ Id: jobId });
      const response = await this.client.send(command);

      if (!response.Job) {
        throw new NotFoundError(`MediaConvert job not found: ${jobId}`);
      }

      const job = response.Job;
      const status = this.mapJobStatus(job);

      logger.debug('MediaConvert job status retrieved', {
        jobId,
        status: status.status,
        progress: status.progress,
      });

      return status;
    } catch (error) {
      logger.error('Failed to get MediaConvert job status', {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new ExternalServiceError(
        'MediaConvert',
        'Failed to get job status',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Cancels a running transcoding job
   */
  async cancelJob(jobId: string): Promise<void> {
    try {
      logger.info('Cancelling MediaConvert job', { jobId });

      await this.ensureEndpoint();

      const command = new CancelJobCommand({ Id: jobId });
      await this.client.send(command);

      logger.info('MediaConvert job cancelled successfully', { jobId });
    } catch (error) {
      logger.error('Failed to cancel MediaConvert job', {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof Error && error.name === 'NotFoundException') {
        throw new NotFoundError(`MediaConvert job not found: ${jobId}`);
      }

      throw new ExternalServiceError(
        'MediaConvert',
        'Failed to cancel job',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Lists recent transcoding jobs
   */
  async listJobs(
    maxResults = 20,
    nextToken?: string
  ): Promise<{
    jobs: JobStatus[];
    nextToken?: string;
  }> {
    try {
      logger.debug('Listing MediaConvert jobs', { maxResults, nextToken });

      await this.ensureEndpoint();

      const command = new ListJobsCommand({
        MaxResults: maxResults,
        NextToken: nextToken,
        Order: 'DESCENDING',
        Status: undefined, // Get all statuses
      });

      const response = await this.client.send(command);

      const jobs = (response.Jobs || []).map((job) => this.mapJobStatus(job));

      logger.debug('MediaConvert jobs listed successfully', {
        jobCount: jobs.length,
        hasNextToken: !!response.NextToken,
      });

      return {
        jobs,
        nextToken: response.NextToken,
      };
    } catch (error) {
      logger.error('Failed to list MediaConvert jobs', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new ExternalServiceError(
        'MediaConvert',
        'Failed to list jobs',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Gets MediaConvert service endpoint for the current region
   */
  async getServiceEndpoint(): Promise<string> {
    try {
      if (this.endpoint) {
        return this.endpoint;
      }

      logger.debug('Discovering MediaConvert endpoint');

      const command = new DescribeEndpointsCommand({});
      const response = await this.client.send(command);

      if (!response.Endpoints || response.Endpoints.length === 0) {
        throw new ExternalServiceError(
          'MediaConvert',
          'No endpoints available',
          new Error('MediaConvert endpoints not found')
        );
      }

      this.endpoint = response.Endpoints[0]?.Url || '';

      // Update client with discovered endpoint
      const awsConfig = secrets.getAwsConfig();
      this.client = new MediaConvertClient({
        region: awsConfig.region,
        endpoint: this.endpoint,
        credentials:
          awsConfig.accessKeyId && awsConfig.secretAccessKey
            ? {
                accessKeyId: awsConfig.accessKeyId,
                secretAccessKey: awsConfig.secretAccessKey,
              }
            : undefined,
      });

      logger.info('MediaConvert endpoint discovered', { endpoint: this.endpoint });

      return this.endpoint;
    } catch (error) {
      logger.error('Failed to get MediaConvert endpoint', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new ExternalServiceError(
        'MediaConvert',
        'Failed to get service endpoint',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Validates MediaConvert configuration
   */
  async validateConfiguration(): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      // Check required configuration
      if (!config.mediaConvert.roleArn) {
        errors.push('MediaConvert role ARN not configured');
      }

      if (!config.mediaConvert.queueArn) {
        errors.push('MediaConvert queue ARN not configured');
      }

      if (!config.aws.region) {
        errors.push('AWS region not configured');
      }

      // Test endpoint discovery if basic config is valid
      if (errors.length === 0) {
        try {
          await this.getServiceEndpoint();
        } catch (error) {
          errors.push(
            `Failed to discover MediaConvert endpoint: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      const isValid = errors.length === 0;

      logger.info('MediaConvert configuration validation completed', {
        isValid,
        errorCount: errors.length,
      });

      return { isValid, errors };
    } catch (error) {
      logger.error('MediaConvert configuration validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      errors.push(
        `Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return { isValid: false, errors };
    }
  }

  // Private helper methods

  private async ensureEndpoint(): Promise<void> {
    if (!this.endpoint) {
      await this.getServiceEndpoint();
    }
  }

  private validateJobInput(input: TranscodingJobInput): void {
    if (!input.inputS3Bucket) {
      throw new ValidationError('Input S3 bucket is required');
    }

    if (!input.inputS3Key) {
      throw new ValidationError('Input S3 key is required');
    }

    if (!input.outputS3Bucket) {
      throw new ValidationError('Output S3 bucket is required');
    }

    if (!input.outputS3KeyPrefix) {
      throw new ValidationError('Output S3 key prefix is required');
    }

    if (!input.jobName) {
      throw new ValidationError('Job name is required');
    }

    if (!input.resolutions || input.resolutions.length === 0) {
      throw new ValidationError('At least one resolution is required');
    }

    // Validate each resolution
    for (const resolution of input.resolutions) {
      if (!resolution.name || !resolution.width || !resolution.height || !resolution.bitrate) {
        throw new ValidationError(
          `Invalid resolution configuration: ${JSON.stringify(resolution)}`
        );
      }
    }
  }

  private buildJobSettings(input: TranscodingJobInput): JobSettings {
    const resolutions =
      input.resolutions.length > 0 ? input.resolutions : DEFAULT_TRANSCODING_RESOLUTIONS;

    // Build HLS output group
    const hlsOutputGroup: OutputGroup = {
      Name: 'HLS',
      OutputGroupSettings: {
        Type: 'HLS_GROUP_SETTINGS',
        HlsGroupSettings: {
          Destination: `s3://${input.outputS3Bucket}/${input.outputS3KeyPrefix}/hls/`,
          SegmentLength: input.hlsSegmentDuration || HLS_JOB_TEMPLATE.segmentDuration,
          SegmentControl: 'SEGMENTED_FILES',
          ManifestCompression: 'NONE',
          CaptionLanguageSetting: 'OMIT',
          ProgramDateTimePeriod: HLS_JOB_TEMPLATE.programDateTimePeriod,
          ProgramDateTime: 'EXCLUDE',
          TimedMetadata: 'NONE',
          TimedMetadataId3Frame: 'NONE',
          TimedMetadataId3Period: HLS_JOB_TEMPLATE.timedMetadataId3Period,
        } as HlsGroupSettings,
      },
      Outputs: resolutions.map((resolution, index) => this.buildHlsOutput(resolution, index)),
    };

    // Build thumbnail output group if requested
    const outputGroups: OutputGroup[] = [hlsOutputGroup];

    if (input.thumbnailGeneration) {
      const thumbnailOutputGroup: OutputGroup = {
        Name: 'Thumbnails',
        OutputGroupSettings: {
          Type: 'FILE_GROUP_SETTINGS',
          FileGroupSettings: {
            Destination: `s3://${input.outputS3Bucket}/${input.outputS3KeyPrefix}/thumbnails/`,
          },
        },
        Outputs: [
          {
            NameModifier: '_thumbnail',
            VideoDescription: {
              CodecSettings: {
                Codec: 'FRAME_CAPTURE',
                FrameCaptureSettings: {
                  FramerateNumerator: 1,
                  FramerateDenominator: 10, // 1 frame every 10 seconds
                  MaxCaptures: 10,
                  Quality: 80,
                },
              },
              Width: 1280,
              Height: 720,
            },
            ContainerSettings: {
              Container: 'RAW',
            },
          },
        ],
      };
      outputGroups.push(thumbnailOutputGroup);
    }

    const jobSettings: JobSettings = {
      Inputs: [
        {
          FileInput: `s3://${input.inputS3Bucket}/${input.inputS3Key}`,
          AudioSelectors: {
            'Audio Selector 1': {
              DefaultSelection: 'DEFAULT',
            },
          },
          VideoSelector: {},
        },
      ],
      OutputGroups: outputGroups,
    };

    return jobSettings;
  }

  private buildHlsOutput(resolution: TranscodingResolution, _index: number): Output {
    return {
      NameModifier: `_${resolution.name}`,
      VideoDescription: {
        CodecSettings: {
          Codec: 'H_264',
          H264Settings: {
            RateControlMode: 'CBR',
            Bitrate: Math.floor(resolution.bitrate / 1000), // Convert to Kbps
            MaxBitrate: resolution.maxBitrate
              ? Math.floor(resolution.maxBitrate / 1000)
              : undefined,
            FramerateControl: 'INITIALIZE_FROM_SOURCE',
            GopSize: 2.0,
            GopSizeUnits: 'SECONDS',
            NumberBFramesBetweenReferenceFrames: 2,
            Syntax: 'DEFAULT',
            SlowPal: 'DISABLED',
            SpatialAdaptiveQuantization: 'ENABLED',
            TemporalAdaptiveQuantization: 'ENABLED',
            FlickerAdaptiveQuantization: 'DISABLED',
            EntropyEncoding: 'CABAC',
            Profile: 'MAIN',
            Level: 'AUTO',
            LookAheadRateControl: 'MEDIUM',
            ParControl: 'INITIALIZE_FROM_SOURCE',
            NumberReferenceFrames: 3,
            DynamicSubGop: 'STATIC',
          },
        } as VideoCodecSettings,
        Width: resolution.width,
        Height: resolution.height,
        RespondToAfd: 'NONE',
        ScalingBehavior: 'DEFAULT',
        TimecodeInsertion: 'DISABLED',
        AntiAlias: 'ENABLED',
        Sharpness: 50,
        AfdSignaling: 'NONE',
        DropFrameTimecode: 'ENABLED',
        ColorMetadata: 'INSERT',
      },
      AudioDescriptions: [
        {
          AudioSourceName: 'Audio Selector 1',
          CodecSettings: {
            Codec: 'AAC',
            AacSettings: {
              Bitrate: 128000,
              CodingMode: 'CODING_MODE_2_0',
              SampleRate: 48000,
              Specification: 'MPEG4',
              AudioDescriptionBroadcasterMix: 'NORMAL',
              RateControlMode: 'CBR',
              RawFormat: 'NONE',
            },
          } as AudioCodecSettings,
          LanguageCodeControl: 'FOLLOW_INPUT',
        },
      ],
      ContainerSettings: {
        Container: 'M3U8',
        M3u8Settings: {
          AudioFramesPerPes: 4,
          PcrControl: 'PCR_EVERY_PES_PACKET',
          PmtPid: 480,
          PrivateMetadataPid: 503,
          ProgramNumber: 1,
          PatInterval: 0,
          PmtInterval: 0,
          Scte35Source: 'NONE',
          NielsenId3: 'NONE',
          TimedMetadata: 'NONE',
          VideoPid: 481,
          AudioPids: [482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492],
        },
      } as ContainerSettings,
    };
  }

  private mapJobStatus(job: Job): JobStatus {
    const outputs: TranscodingJobOutput[] = [];

    // Extract output information from job details
    if (job.Settings?.OutputGroups) {
      for (const outputGroup of job.Settings.OutputGroups) {
        if (outputGroup.Name === 'HLS' && outputGroup.Outputs) {
          for (const output of outputGroup.Outputs) {
            if (output.NameModifier && output.VideoDescription) {
              const resolution = output.NameModifier.replace('_', '');
              const outputS3Key = `${outputGroup.OutputGroupSettings?.HlsGroupSettings?.Destination || ''}${output.NameModifier}.m3u8`;

              outputs.push({
                resolution,
                outputS3Key,
                outputUrl: outputS3Key,
                bitrate: output.VideoDescription.CodecSettings?.H264Settings?.Bitrate || 0,
              });
            }
          }
        }
      }
    }

    return {
      jobId: job.Id || '',
      status: this.mapMediaConvertStatus(job.Status),
      progress: job.JobPercentComplete,
      errorMessage: job.ErrorMessage,
      errorCode: job.ErrorCode?.toString(),
      createdAt: job.CreatedAt,
      completedAt: (job as Job & { CompletedAt?: Date }).CompletedAt || undefined,
      outputs,
    };
  }

  private mapMediaConvertStatus(status?: MediaConvertJobStatus): JobStatus['status'] {
    switch (status) {
      case 'SUBMITTED':
        return 'SUBMITTED';
      case 'PROGRESSING':
        return 'PROGRESSING';
      case 'COMPLETE':
        return 'COMPLETE';
      case 'CANCELED':
        return 'CANCELED';
      case 'ERROR':
        return 'ERROR';
      default:
        return 'SUBMITTED';
    }
  }
}
