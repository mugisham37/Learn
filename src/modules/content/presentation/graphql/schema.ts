/**
 * GraphQL Schema for Content Module
 *
 * Defines GraphQL types, inputs, and schema for video assets, file assets,
 * processing jobs, and content management operations.
 *
 * Requirements: 21.1, 21.2
 */

import { gql } from 'graphql-tag';

/**
 * GraphQL type definitions for content module
 */
export const contentTypeDefs = gql`
  # Scalar types
  scalar DateTime
  scalar JSON
  scalar Decimal

  # User type (from users module)
  type User {
    id: ID!
    email: String!
    role: String!
    profile: UserProfile
  }

  type UserProfile {
    fullName: String!
    avatarUrl: String
  }

  # Course and Lesson types (from courses module)
  type Course {
    id: ID!
    title: String!
    slug: String!
  }

  type Lesson {
    id: ID!
    title: String!
    type: String!
  }

  # Enums
  enum ProcessingStatus {
    PENDING
    IN_PROGRESS
    COMPLETED
    FAILED
    CANCELLED
  }

  enum AssetType {
    VIDEO
    IMAGE
    DOCUMENT
    AUDIO
    ARCHIVE
  }

  enum JobType {
    VIDEO_TRANSCODE
    IMAGE_PROCESS
    DOCUMENT_CONVERT
    AUDIO_PROCESS
    THUMBNAIL_GENERATE
  }

  enum AccessLevel {
    PUBLIC
    COURSE
    LESSON
    PRIVATE
  }

  # Video Resolution type
  type VideoResolution {
    resolution: String!
    url: String!
    bitrate: Int!
    width: Int!
    height: Int!
  }

  # Streaming URLs type
  type StreamingUrls {
    hls: String
    dash: String
    mp4: JSON
  }

  # File Variants type
  type FileVariants {
    thumbnail: String
    compressed: String
    preview: String
  }

  # Video Asset Object Type
  type VideoAsset {
    id: ID!
    lesson: Lesson
    uploadedBy: User!
    originalFileName: String!
    originalFileSize: Int!
    mimeType: String!
    s3Bucket: String!
    s3Key: String!
    s3Region: String!
    processingStatus: ProcessingStatus!
    processingJobId: String
    processingStartedAt: DateTime
    processingCompletedAt: DateTime
    processingErrorMessage: String
    durationSeconds: Int
    originalResolution: String
    originalBitrate: Int
    originalFrameRate: Decimal
    hlsManifestUrl: String
    thumbnailUrl: String
    previewUrl: String
    availableResolutions: [VideoResolution!]!
    cloudfrontDistribution: String
    streamingUrls: StreamingUrls!
    metadata: JSON!
    createdAt: DateTime!
    updatedAt: DateTime!

    # Computed fields
    formattedDuration: String
    formattedFileSize: String!
    isProcessing: Boolean!
    isProcessed: Boolean!
    isProcessingFailed: Boolean!
    isReadyForStreaming: Boolean!
    processingProgress: Int!
    bestResolution: VideoResolution
    hasThumbnail: Boolean!
    hasPreview: Boolean!
    supportsAdaptiveStreaming: Boolean!
  }

  # File Asset Object Type
  type FileAsset {
    id: ID!
    course: Course
    lesson: Lesson
    uploadedBy: User!
    fileName: String!
    originalFileName: String!
    fileSize: Int!
    mimeType: String!
    assetType: AssetType!
    s3Bucket: String!
    s3Key: String!
    s3Region: String!
    isPublic: Boolean!
    accessLevel: AccessLevel!
    cloudfrontUrl: String
    processingStatus: ProcessingStatus!
    processingErrorMessage: String
    variants: FileVariants!
    description: String
    tags: [String!]!
    metadata: JSON!
    expiresAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!

    # Computed fields
    formattedFileSize: String!
    fileExtension: String!
    displayName: String!
    isImage: Boolean!
    isDocument: Boolean!
    isAudio: Boolean!
    isArchive: Boolean!
    isProcessing: Boolean!
    isProcessed: Boolean!
    isProcessingFailed: Boolean!
    isExpired: Boolean!
    isPubliclyAccessible: Boolean!
    cdnUrl: String
    thumbnailUrl: String
    previewUrl: String
    compressedUrl: String
    hasThumbnail: Boolean!
    hasPreview: Boolean!
    imageDimensions: ImageDimensions
    pageCount: Int
    isSafeForPreview: Boolean!
    timeUntilExpiration: Int
    isExpiringSoon: Boolean!
    iconClass: String!
  }

  # Processing Job Object Type
  type ProcessingJob {
    id: ID!
    videoAsset: VideoAsset
    fileAsset: FileAsset
    jobType: JobType!
    externalJobId: String
    externalServiceName: String
    jobConfiguration: JSON!
    status: ProcessingStatus!
    progress: Int!
    startedAt: DateTime
    completedAt: DateTime
    result: JSON
    errorMessage: String
    errorCode: String
    attemptCount: Int!
    maxAttempts: Int!
    nextRetryAt: DateTime
    priority: Int!
    scheduledFor: DateTime
    metadata: JSON!
    createdAt: DateTime!
    updatedAt: DateTime!

    # Computed fields
    isPending: Boolean!
    isInProgress: Boolean!
    isCompleted: Boolean!
    isFailed: Boolean!
    isCancelled: Boolean!
    isFinal: Boolean!
    canRetry: Boolean!
    isReadyForRetry: Boolean!
    isScheduled: Boolean!
    isReadyToExecute: Boolean!
    duration: Int
    formattedDuration: String
    timeUntilRetry: Int
    timeUntilScheduled: Int
    estimatedCompletionTime: DateTime
    hasExceededTimeout: Boolean!
    priorityDescription: String!
    isHighPriority: Boolean!
    jobTypeDescription: String!
  }

  # Helper types
  type ImageDimensions {
    width: Int!
    height: Int!
  }

  # Presigned URL response
  type PresignedUploadUrl {
    uploadUrl: String!
    fileKey: String!
    expiresIn: Int!
    maxFileSize: Int!
  }

  # Signed streaming URL response
  type SignedStreamingUrl {
    streamingUrl: String!
    expiresAt: DateTime!
    resolution: String
    format: String!
  }

  # Connection types for pagination
  type VideoAssetConnection {
    edges: [VideoAssetEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type VideoAssetEdge {
    node: VideoAsset!
    cursor: String!
  }

  type FileAssetConnection {
    edges: [FileAssetEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type FileAssetEdge {
    node: FileAsset!
    cursor: String!
  }

  type ProcessingJobConnection {
    edges: [ProcessingJobEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type ProcessingJobEdge {
    node: ProcessingJob!
    cursor: String!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  # Input Types
  input GenerateUploadUrlInput {
    fileName: String!
    fileType: String!
    fileSize: Int!
    lessonId: ID
    courseId: ID
  }

  input UploadCourseResourceInput {
    courseId: ID!
    fileName: String!
    fileType: String!
    fileSize: Int!
    description: String
    tags: [String!]
    isPublic: Boolean
    accessLevel: AccessLevel
  }

  input VideoAssetFilter {
    lessonId: ID
    uploadedBy: ID
    processingStatus: ProcessingStatus
    hasProcessingError: Boolean
    minDuration: Int
    maxDuration: Int
    minFileSize: Int
    maxFileSize: Int
  }

  input FileAssetFilter {
    courseId: ID
    lessonId: ID
    uploadedBy: ID
    assetType: AssetType
    processingStatus: ProcessingStatus
    accessLevel: AccessLevel
    isPublic: Boolean
    isExpired: Boolean
    tags: [String!]
  }

  input ProcessingJobFilter {
    videoAssetId: ID
    fileAssetId: ID
    jobType: JobType
    status: ProcessingStatus
    priority: Int
    minPriority: Int
    maxPriority: Int
    hasError: Boolean
    canRetry: Boolean
  }

  input PaginationInput {
    first: Int
    after: String
    last: Int
    before: String
  }

  # Mutations
  type Mutation {
    # Upload URL generation
    generateUploadUrl(input: GenerateUploadUrlInput!): PresignedUploadUrl!

    # Course resource upload
    uploadCourseResource(input: UploadCourseResourceInput!): FileAsset!

    # Content deletion
    deleteContent(fileKey: String!): Boolean!
    deleteVideoAsset(id: ID!): Boolean!
    deleteFileAsset(id: ID!): Boolean!

    # Processing job management
    retryProcessingJob(id: ID!): ProcessingJob!
    cancelProcessingJob(id: ID!): ProcessingJob!
  }

  # Queries
  type Query {
    # Single asset queries
    videoAsset(id: ID!): VideoAsset
    fileAsset(id: ID!): FileAsset
    processingJob(id: ID!): ProcessingJob

    # Asset list queries with pagination and filtering
    videoAssets(filter: VideoAssetFilter, pagination: PaginationInput): VideoAssetConnection!

    fileAssets(filter: FileAssetFilter, pagination: PaginationInput): FileAssetConnection!

    processingJobs(
      filter: ProcessingJobFilter
      pagination: PaginationInput
    ): ProcessingJobConnection!

    # Video processing status
    videoProcessingStatus(videoAssetId: ID!): ProcessingJob

    # Streaming URL generation
    generateStreamingUrl(lessonId: ID!, resolution: String, format: String): SignedStreamingUrl!

    # My uploaded content (requires authentication)
    myVideoAssets(filter: VideoAssetFilter, pagination: PaginationInput): VideoAssetConnection!

    myFileAssets(filter: FileAssetFilter, pagination: PaginationInput): FileAssetConnection!
  }
`;
