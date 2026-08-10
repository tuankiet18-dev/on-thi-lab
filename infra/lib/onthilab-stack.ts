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
import * as iam from "aws-cdk-lib/aws-iam";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
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

    const ocrDlq = new sqs.Queue(this, "OcrDlq", {
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      retentionPeriod: Duration.days(14),
    });

    const ocrQueue = new sqs.Queue(this, "OcrQueue", {
      // OCR does not need ordered delivery. A standard queue lets different
      // question images run concurrently; the database claim below makes
      // at-least-once delivery idempotent before a Textract request is made.
      queueName: `onthilab-ocr-${props.stage}`,
      visibilityTimeout: Duration.minutes(3),
      deadLetterQueue: {
        queue: ocrDlq,
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

    new cloudwatch.Alarm(this, "OcrDeadLetterQueueAlarm", {
      metric: ocrDlq.metricApproximateNumberOfMessagesVisible(),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator:
        cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: "Alert when an OCR job reaches the DLQ.",
    });

    new cloudwatch.Alarm(this, "OcrQueueOldMessageAlarm", {
      metric: ocrQueue.metricApproximateAgeOfOldestMessage(),
      threshold: Duration.minutes(15).toSeconds(),
      evaluationPeriods: 1,
      comparisonOperator:
        cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription:
        "Alert when OCR work is waiting for more than 15 minutes.",
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
          format: lambdaNodejs.OutputFormat.ESM,
          banner:
            "import { createRequire } from 'module';const require = createRequire(import.meta.url);",
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
          OCR_QUEUE_URL: ocrQueue.queueUrl,
        },
      });
      databaseParameter.grantRead(apiHandler);
      aiApiKeyParameter?.grantRead(apiHandler);
      questionImageBucket.grantReadWrite(apiHandler);
      importQueue.grantSendMessages(apiHandler);
      ocrQueue.grantSendMessages(apiHandler);

      const workerHandler = new lambdaNodejs.NodejsFunction(
        this,
        "WorkerHandler",
        {
          runtime: lambda.Runtime.NODEJS_22_X,
          entry: join(projectRoot, "apps/worker/src/lambda.ts"),
          handler: "handler",
          memorySize: 512,
          timeout: Duration.minutes(2),
          architecture: lambda.Architecture.ARM_64,
          bundling: {
            minify: true,
            sourceMap: true,
            target: "node22",
            format: lambdaNodejs.OutputFormat.ESM,
            banner:
              "import { createRequire } from 'module';const require = createRequire(import.meta.url);",
            nodeModules: [],
            commandHooks: {
              beforeBundling(inputDir: string, outputDir: string): string[] {
                return [];
              },
              beforeInstall(inputDir: string, outputDir: string): string[] {
                return [];
              },
              afterBundling(inputDir: string, outputDir: string): string[] {
                return [
                  `cd ${outputDir} && npm init -y && npm install --os=linux --cpu=arm64 sharp`,
                ];
              },
            },
          },
          environment: {
            DATABASE_PARAMETER_NAME: props.databaseParameterName,
            QUESTION_IMAGE_BUCKET: questionImageBucket.bucketName,
            OCR_QUEUE_URL: ocrQueue.queueUrl,
          },
        },
      );

      databaseParameter.grantRead(workerHandler);
      questionImageBucket.grantReadWrite(workerHandler);

      workerHandler.addEventSource(
        new SqsEventSource(ocrQueue, {
          batchSize: 1,
          maxConcurrency: 3,
        }),
      );

      workerHandler.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["textract:DetectDocumentText"],
          resources: ["*"],
        }),
      );

      new cloudwatch.Alarm(this, "OcrWorkerErrorAlarm", {
        metric: workerHandler.metricErrors({ period: Duration.minutes(5) }),
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        alarmDescription: "Alert when the OCR worker throws an error.",
      });

      new cloudwatch.Alarm(this, "OcrWorkerThrottleAlarm", {
        metric: workerHandler.metricThrottles({ period: Duration.minutes(5) }),
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        alarmDescription: "Alert when OCR worker concurrency is throttled.",
      });

      const api = new apigateway.LambdaRestApi(this, "PublicApi", {
        handler: apiHandler,
        proxy: true,
        // Lambda proxy responses encode binary bodies as Base64. API Gateway
        // Register only the image formats served by the question-image route.
        // Keeping JSON/OPTIONS outside the binary list is important: API
        // Gateway must return the CORS preflight as a normal 204 response so
        // authenticated browser requests (for example /v1/me) can proceed.
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
    new CfnOutput(this, "OcrQueueUrl", { value: ocrQueue.queueUrl });
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
