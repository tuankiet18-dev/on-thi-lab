import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
} from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sqs from "aws-cdk-lib/aws-sqs";
import type { Construct } from "constructs";

interface OnThiLabStackProps extends StackProps {
  stage: string;
}

export class OnThiLabStack extends Stack {
  constructor(scope: Construct, id: string, props: OnThiLabStackProps) {
    super(scope, id, props);

    const isProduction = props.stage === "prod";
    const dataRemovalPolicy = isProduction
      ? RemovalPolicy.RETAIN
      : RemovalPolicy.DESTROY;

    const webBucket = new s3.Bucket(this, "WebBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: dataRemovalPolicy,
      autoDeleteObjects: !isProduction,
    });

    const distribution = new cloudfront.Distribution(this, "WebDistribution", {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(webBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: "index.html",
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: Duration.minutes(5),
        },
      ],
    });

    const questionImageBucket = new s3.Bucket(this, "QuestionImageBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,
      removalPolicy: dataRemovalPolicy,
      autoDeleteObjects: !isProduction,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: [
            "http://localhost:5173",
            `https://${distribution.distributionDomainName}`,
          ],
          allowedHeaders: ["content-type"],
          maxAge: 600,
        },
      ],
      lifecycleRules: [
        {
          id: "expire-unprocessed-upload-archives",
          prefix: "uploads/",
          expiration: Duration.days(1),
        },
        {
          id: "abort-incomplete-multipart-uploads",
          abortIncompleteMultipartUploadAfter: Duration.days(1),
        },
      ],
    });

    const deadLetterQueue = new sqs.Queue(this, "ImportDeadLetterQueue", {
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      retentionPeriod: Duration.days(14),
    });

    const importQueue = new sqs.Queue(this, "ImportQueue", {
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      visibilityTimeout: Duration.minutes(5),
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    new cloudwatch.Alarm(this, "ImportDeadLetterQueueAlarm", {
      metric: deadLetterQueue.metricApproximateNumberOfMessagesVisible(),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator:
        cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: "Alert when there are messages in the DLQ.",
    });

    new cloudwatch.Alarm(this, "ImportQueueOldMessageAlarm", {
      metric: importQueue.metricApproximateAgeOfOldestMessage(),
      threshold: Duration.hours(1).toSeconds(),
      evaluationPeriods: 1,
      comparisonOperator:
        cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: "Alert when messages are stuck in the queue for >1hr.",
    });

    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: "database",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    const database = new rds.DatabaseCluster(this, "Database", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_6,
      }),
      writer: rds.ClusterInstance.serverlessV2("writer"),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 2,
      enableDataApi: true,
      defaultDatabaseName: "onthilab",
      storageEncrypted: true,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      backup: {
        retention: Duration.days(isProduction ? 14 : 1),
      },
      removalPolicy: dataRemovalPolicy,
    });

    new CfnOutput(this, "WebDistributionDomain", {
      value: distribution.distributionDomainName,
    });
    new CfnOutput(this, "QuestionImageBucketName", {
      value: questionImageBucket.bucketName,
    });
    new CfnOutput(this, "ImportQueueUrl", { value: importQueue.queueUrl });
    new CfnOutput(this, "AiSuggestionQueueUrl", {
      value: importQueue.queueUrl,
      description: "Set this value as AI_SUGGESTION_QUEUE_URL.",
    });
    new CfnOutput(this, "DatabaseClusterArn", {
      value: database.clusterArn,
    });
  }
}
