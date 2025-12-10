/**
 * Video Processing Lambda Deployment Script
 * 
 * Deploys the video processing Lambda function to AWS with proper
 * configuration, permissions, and S3 triggers.
 * 
 * Requirements:
 * - 4.2: Lambda function for S3 upload triggers
 * - 4.3: MediaConvert job initiation
 * - 4.4: Proper IAM permissions and configuration
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { config } from '../src/config/index.js';

/**
 * Lambda deployment configuration
 */
interface LambdaDeploymentConfig {
  functionName: string;
  runtime: string;
  handler: string;
  timeout: number;
  memorySize: number;
  environment: Record<string, string>;
  iamRole: string;
  s3Bucket: string;
  s3KeyPrefix: string;
}

/**
 * CloudFormation template for Lambda deployment
 */
const CLOUDFORMATION_TEMPLATE = {
  AWSTemplateFormatVersion: '2010-09-09',
  Description: 'Learning Platform Video Processing Lambda Function',
  
  Parameters: {
    S3BucketName: {
      Type: 'String',
      Description: 'S3 bucket name for video uploads',
    },
    MediaConvertRoleArn: {
      Type: 'String',
      Description: 'IAM role ARN for MediaConvert service',
    },
    MediaConvertQueueArn: {
      Type: 'String',
      Description: 'MediaConvert queue ARN',
    },
    WebhookUrl: {
      Type: 'String',
      Description: 'Webhook URL for job completion notifications',
      Default: '',
    },
  },

  Resources: {
    // Lambda execution role
    VideoProcessingLambdaRole: {
      Type: 'AWS::IAM::Role',
      Properties: {
        RoleName: 'learning-platform-video-processing-lambda-role',
        AssumeRolePolicyDocument: {
          Version: '2012-10-17',
          Statement: [{
            Effect: 'Allow',
            Principal: { Service: 'lambda.amazonaws.com' },
            Action: 'sts:AssumeRole',
          }],
        },
        ManagedPolicyArns: [
          'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
        ],
        Policies: [{
          PolicyName: 'VideoProcessingPolicy',
          PolicyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: [
                  's3:GetObject',
                  's3:GetObjectVersion',
                ],
                Resource: { 'Fn::Sub': '${S3BucketName}/*' },
              },
              {
                Effect: 'Allow',
                Action: [
                  'mediaconvert:CreateJob',
                  'mediaconvert:GetJob',
                  'mediaconvert:ListJobs',
                  'mediaconvert:DescribeEndpoints',
                ],
                Resource: '*',
              },
              {
                Effect: 'Allow',
                Action: 'iam:PassRole',
                Resource: { Ref: 'MediaConvertRoleArn' },
              },
              {
                Effect: 'Allow',
                Action: [
                  'logs:CreateLogGroup',
                  'logs:CreateLogStream',
                  'logs:PutLogEvents',
                ],
                Resource: 'arn:aws:logs:*:*:*',
              },
            ],
          },
        }],
      },
    },

    // Lambda function
    VideoProcessingLambda: {
      Type: 'AWS::Lambda::Function',
      Properties: {
        FunctionName: 'learning-platform-video-processor',
        Runtime: 'nodejs20.x',
        Handler: 'VideoProcessingLambda.handler',
        Role: { 'Fn::GetAtt': ['VideoProcessingLambdaRole', 'Arn'] },
        Code: {
          ZipFile: '// Placeholder - will be updated with actual code',
        },
        Timeout: 300,
        MemorySize: 512,
        Environment: {
          Variables: {
            NODE_ENV: 'production',
            LOG_LEVEL: 'info',
            OUTPUT_S3_BUCKET: { Ref: 'S3BucketName' },
            MEDIACONVERT_ROLE_ARN: { Ref: 'MediaConvertRoleArn' },
            MEDIACONVERT_QUEUE_ARN: { Ref: 'MediaConvertQueueArn' },
            WEBHOOK_URL: { Ref: 'WebhookUrl' },
          },
        },
        Tags: [
          { Key: 'Project', Value: 'learning-platform' },
          { Key: 'Component', Value: 'video-processing' },
          { Key: 'Environment', Value: 'production' },
        ],
      },
    },

    // S3 bucket notification permission
    LambdaInvokePermission: {
      Type: 'AWS::Lambda::Permission',
      Properties: {
        FunctionName: { Ref: 'VideoProcessingLambda' },
        Action: 'lambda:InvokeFunction',
        Principal: 's3.amazonaws.com',
        SourceArn: { 'Fn::Sub': 'arn:aws:s3:::${S3BucketName}' },
      },
    },

    // CloudWatch Log Group
    VideoProcessingLogGroup: {
      Type: 'AWS::Logs::LogGroup',
      Properties: {
        LogGroupName: { 'Fn::Sub': '/aws/lambda/${VideoProcessingLambda}' },
        RetentionInDays: 14,
      },
    },
  },

  Outputs: {
    LambdaFunctionArn: {
      Description: 'ARN of the video processing Lambda function',
      Value: { 'Fn::GetAtt': ['VideoProcessingLambda', 'Arn'] },
      Export: { Name: 'learning-platform-video-processing-lambda-arn' },
    },
    LambdaRoleArn: {
      Description: 'ARN of the Lambda execution role',
      Value: { 'Fn::GetAtt': ['VideoProcessingLambdaRole', 'Arn'] },
      Export: { Name: 'learning-platform-video-processing-lambda-role-arn' },
    },
  },
};

/**
 * Deployment script main function
 */
async function deployVideoProcessingLambda(): Promise<void> {
  try {
    console.log('🚀 Starting video processing Lambda deployment...');

    // Validate configuration
    validateConfiguration();

    // Create deployment directory
    const deployDir = join(process.cwd(), 'deploy');
    if (!existsSync(deployDir)) {
      mkdirSync(deployDir, { recursive: true });
    }

    // Generate CloudFormation template
    const templatePath = join(deployDir, 'video-processing-lambda.yaml');
    writeFileSync(templatePath, JSON.stringify(CLOUDFORMATION_TEMPLATE, null, 2));
    console.log('✅ CloudFormation template generated');

    // Build Lambda package
    console.log('📦 Building Lambda package...');
    buildLambdaPackage(deployDir);

    // Deploy CloudFormation stack
    console.log('☁️ Deploying CloudFormation stack...');
    deployCloudFormationStack(templatePath);

    // Update Lambda function code
    console.log('🔄 Updating Lambda function code...');
    updateLambdaCode(deployDir);

    // Configure S3 bucket notification
    console.log('🔔 Configuring S3 bucket notification...');
    configureS3Notification();

    console.log('🎉 Video processing Lambda deployment completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Test the Lambda function with a video upload');
    console.log('2. Monitor CloudWatch logs for any issues');
    console.log('3. Configure MediaConvert webhook endpoint');
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  }
}

/**
 * Validates deployment configuration
 */
function validateConfiguration(): void {
  const requiredEnvVars = [
    'S3_BUCKET_NAME',
    'MEDIACONVERT_ROLE_ARN',
    'MEDIACONVERT_QUEUE_ARN',
    'AWS_REGION',
  ];

  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  console.log('✅ Configuration validated');
}

/**
 * Builds Lambda deployment package
 */
function buildLambdaPackage(deployDir: string): void {
  const packageDir = join(deployDir, 'lambda-package');
  
  // Create package directory
  if (!existsSync(packageDir)) {
    mkdirSync(packageDir, { recursive: true });
  }

  // Copy Lambda source files
  execSync(`cp -r src/shared/services/VideoProcessingLambda.ts ${packageDir}/`);
  execSync(`cp -r src/shared/services/MediaConvertService.ts ${packageDir}/`);
  execSync(`cp -r src/shared/services/IMediaConvertService.ts ${packageDir}/`);
  execSync(`cp -r src/shared/utils/logger.ts ${packageDir}/`);
  execSync(`cp -r src/shared/errors/ ${packageDir}/`);
  execSync(`cp package.json ${packageDir}/`);

  // Install production dependencies
  execSync('npm ci --production', { cwd: packageDir });

  // Compile TypeScript
  execSync('npx tsc --target es2020 --module commonjs --outDir dist', { cwd: packageDir });

  // Create deployment zip
  execSync(`cd ${packageDir} && zip -r ../lambda-package.zip .`);

  console.log('✅ Lambda package built');
}

/**
 * Deploys CloudFormation stack
 */
function deployCloudFormationStack(templatePath: string): void {
  const stackName = 'learning-platform-video-processing-lambda';
  const parameters = [
    `S3BucketName=${process.env.S3_BUCKET_NAME}`,
    `MediaConvertRoleArn=${process.env.MEDIACONVERT_ROLE_ARN}`,
    `MediaConvertQueueArn=${process.env.MEDIACONVERT_QUEUE_ARN}`,
    `WebhookUrl=${process.env.WEBHOOK_URL || ''}`,
  ].join(' ');

  try {
    // Try to update existing stack
    execSync(`aws cloudformation update-stack --stack-name ${stackName} --template-body file://${templatePath} --parameters ${parameters} --capabilities CAPABILITY_NAMED_IAM`);
    console.log('📝 Updating existing CloudFormation stack...');
  } catch (error) {
    // Create new stack if update fails
    execSync(`aws cloudformation create-stack --stack-name ${stackName} --template-body file://${templatePath} --parameters ${parameters} --capabilities CAPABILITY_NAMED_IAM`);
    console.log('🆕 Creating new CloudFormation stack...');
  }

  // Wait for stack deployment to complete
  execSync(`aws cloudformation wait stack-update-complete --stack-name ${stackName} || aws cloudformation wait stack-create-complete --stack-name ${stackName}`);
  console.log('✅ CloudFormation stack deployed');
}

/**
 * Updates Lambda function code
 */
function updateLambdaCode(deployDir: string): void {
  const zipPath = join(deployDir, 'lambda-package.zip');
  const functionName = 'learning-platform-video-processor';

  execSync(`aws lambda update-function-code --function-name ${functionName} --zip-file fileb://${zipPath}`);
  console.log('✅ Lambda function code updated');
}

/**
 * Configures S3 bucket notification
 */
function configureS3Notification(): void {
  const bucketName = process.env.S3_BUCKET_NAME!;
  const functionArn = getLambdaFunctionArn();

  const notificationConfig = {
    LambdaConfigurations: [{
      Id: 'video-processing-trigger',
      LambdaFunctionArn: functionArn,
      Events: ['s3:ObjectCreated:*'],
      Filter: {
        Key: {
          FilterRules: [{
            Name: 'prefix',
            Value: 'video/',
          }],
        },
      },
    }],
  };

  const configPath = join(process.cwd(), 'deploy', 'notification-config.json');
  writeFileSync(configPath, JSON.stringify(notificationConfig, null, 2));

  execSync(`aws s3api put-bucket-notification-configuration --bucket ${bucketName} --notification-configuration file://${configPath}`);
  console.log('✅ S3 bucket notification configured');
}

/**
 * Gets Lambda function ARN from CloudFormation stack
 */
function getLambdaFunctionArn(): string {
  const stackName = 'learning-platform-video-processing-lambda';
  const result = execSync(`aws cloudformation describe-stacks --stack-name ${stackName} --query "Stacks[0].Outputs[?OutputKey=='LambdaFunctionArn'].OutputValue" --output text`);
  return result.toString().trim();
}

/**
 * Main execution
 */
if (require.main === module) {
  deployVideoProcessingLambda().catch(console.error);
}

export { deployVideoProcessingLambda };