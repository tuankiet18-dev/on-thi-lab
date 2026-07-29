import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
} from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Construct } from "constructs";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

interface OnThiLabStackProps extends StackProps {
  stage: string;
  cognitoUserPoolId?: string;
  cognitoClientId?: string;
  databaseParameterName?: string;
  webDomainName?: string;
  webCertificateArn?: string;
  aiProvider?: string;
  aiModel?: string;
  aiBaseUrl?: string;
  aiApiKeyParameterName?: string;
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
      ...(props.webDomainName && props.webCertificateArn
        ? {
            domainNames: [props.webDomainName],
            certificate: acm.Certificate.fromCertificateArn(
              this,
              "WebCertificate",
              props.webCertificateArn,
            ),
          }
        : {}),
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
            ...(props.webDomainName ? [`https://${props.webDomainName}`] : []),
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

    if (
      props.databaseParameterName &&
      props.cognitoUserPoolId &&
      props.cognitoClientId
    ) {
      const databaseParameter =
        ssm.StringParameter.fromSecureStringParameterAttributes(
          this,
          "DatabaseParameter",
          {
            parameterName: props.databaseParameterName,
            version: 1,
          },
        );
      const aiApiKeyParameter = props.aiApiKeyParameterName
        ? ssm.StringParameter.fromSecureStringParameterAttributes(
            this,
            "AiApiKeyParameter",
            {
              parameterName: props.aiApiKeyParameterName,
              version: 1,
            },
          )
        : undefined;
      const apiHandler = new lambdaNodejs.NodejsFunction(this, "ApiHandler", {
        runtime: lambda.Runtime.NODEJS_22_X,
        entry: join(projectRoot, "apps/api/src/lambda.ts"),
        handler: "handler",
        memorySize: 1024,
        timeout: Duration.seconds(29),
        bundling: {
          minify: true,
          sourceMap: true,
          target: "node22",
        },
        environment: {
          APP_ENV: props.stage === "prod" ? "production" : "staging",
          LOG_LEVEL: "info",
          DATABASE_PARAMETER_NAME: props.databaseParameterName,
          COGNITO_USER_POOL_ID: props.cognitoUserPoolId,
          COGNITO_CLIENT_ID: props.cognitoClientId,
          QUESTION_IMAGE_BUCKET: questionImageBucket.bucketName,
          ...(props.aiApiKeyParameterName
            ? {
                AI_API_KEY_PARAMETER_NAME: props.aiApiKeyParameterName,
                AI_PROVIDER: props.aiProvider ?? "disabled",
                AI_MODEL: props.aiModel ?? "",
                AI_BASE_URL: props.aiBaseUrl ?? "https://api.openai.com/v1",
              }
            : {}),
          CORS_ORIGINS: [
            `https://${distribution.distributionDomainName}`,
            ...(props.webDomainName ? [`https://${props.webDomainName}`] : []),
          ].join(","),
          FEATURE_GOOGLE_AUTH_ENABLED: "true",
          FEATURE_AI_IMPORT_ENABLED: props.aiApiKeyParameterName
            ? "true"
            : "false",
          FEATURE_MONETIZATION_ENABLED: "false",
        },
      });
      databaseParameter.grantRead(apiHandler);
      aiApiKeyParameter?.grantRead(apiHandler);
      questionImageBucket.grantReadWrite(apiHandler);
      importQueue.grantSendMessages(apiHandler);

      const api = new apigateway.LambdaRestApi(this, "PublicApi", {
        handler: apiHandler,
        proxy: true,
        // Lambda proxy responses encode binary bodies as Base64. API Gateway
        // chooses binary handling from the first browser Accept value (often
        // image/avif), not the response Content-Type. Include that value and
        // the formats we serve without making JSON/OPTIONS binary responses.
        binaryMediaTypes: [
          "image/avif",
          "image/webp",
          "image/png",
          "image/jpeg",
        ],
        deployOptions: {
          stageName: props.stage,
          tracingEnabled: true,
          loggingLevel: apigateway.MethodLoggingLevel.INFO,
          dataTraceEnabled: false,
          metricsEnabled: true,
        },
        defaultCorsPreflightOptions: {
          allowOrigins: [
            `https://${distribution.distributionDomainName}`,
            ...(props.webDomainName ? [`https://${props.webDomainName}`] : []),
          ],
          allowMethods: apigateway.Cors.ALL_METHODS,
          allowHeaders: ["Content-Type", "Authorization", "X-Device-Id"],
        },
      });

      new CfnOutput(this, "ApiEndpoint", {
        value: api.url,
        description: "Set as VITE_API_URL when building the web application.",
      });
    }

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
    new CfnOutput(this, "WebBucketName", {
      value: webBucket.bucketName,
      description: "Deploy the built SPA assets to this private bucket.",
    });
  }
}
