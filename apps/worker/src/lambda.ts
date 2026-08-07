import type { SQSEvent, SQSHandler } from "aws-lambda";
import {
  createDatabaseConnection,
  PostgresOcrRepository,
} from "@onthilab/database";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { TextractClient } from "@aws-sdk/client-textract";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { processOcrJob, type OcrImageReader } from "./ocr-processor.js";

const databaseParameterName = process.env.DATABASE_PARAMETER_NAME;
const questionImageBucket = process.env.QUESTION_IMAGE_BUCKET;

if (!databaseParameterName || !questionImageBucket) {
  throw new Error("Missing required environment variables for worker.");
}

const ssmClient = new SSMClient({});
const s3Client = new S3Client({});
const textractClient = new TextractClient({});
const maxOcrDeliveryAttempts = 3;

class S3ImageReader implements OcrImageReader {
  constructor(private readonly bucketName: string) {}

  async read(imageKey: string) {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: this.bucketName,
        Key: imageKey,
      }),
    );
    if (!response.Body) return null;
    const bytes = await response.Body.transformToByteArray();
    return {
      bytes,
      contentType: response.ContentType ?? "image/jpeg",
    };
  }
}

let ocrRepositoryPromise: Promise<PostgresOcrRepository> | undefined;

async function getOcrRepository() {
  if (!ocrRepositoryPromise) {
    ocrRepositoryPromise = (async () => {
      let connectionString = databaseParameterName!;
      if (connectionString.startsWith("/")) {
        const response = await ssmClient.send(
          new GetParameterCommand({
            Name: connectionString,
            WithDecryption: true,
          }),
        );
        connectionString = response.Parameter?.Value ?? "";
      }
      const dbConnection = createDatabaseConnection(connectionString);
      return new PostgresOcrRepository(dbConnection.db);
    })();
  }
  return ocrRepositoryPromise;
}

const imageReader = new S3ImageReader(questionImageBucket);

export const handler: SQSHandler = async (event: SQSEvent) => {
  const ocrRepository = await getOcrRepository();
  for (const record of event.Records) {
    console.log("Processing message:", record.messageId);
    try {
      const payload = JSON.parse(record.body);

      // We check if it's an OCR job by looking for providerVersion or a specific type field.
      // Assuming all jobs sent to this queue (OcrQueue) are OCR jobs.
      await processOcrJob(payload, {
        repository: ocrRepository,
        images: imageReader,
        textract: textractClient,
      });
    } catch (error) {
      console.error("Error processing message", record.messageId, error);
      const receiveCount = Number(record.attributes.ApproximateReceiveCount);
      if (
        Number.isFinite(receiveCount) &&
        receiveCount < maxOcrDeliveryAttempts
      ) {
        const message =
          error instanceof Error
            ? error.message
            : "OCR worker processing failed";
        try {
          const payload = JSON.parse(record.body) as { questionId?: string };
          if (payload.questionId) {
            await ocrRepository.scheduleOcrRetry(payload.questionId, message);
          }
        } catch (retryError) {
          // Keep the original failure visible to SQS. A failed state is safer
          // than accidentally acknowledging an OCR message we could not reset.
          console.error(
            "Could not schedule OCR retry",
            record.messageId,
            retryError,
          );
        }
      }
      throw error; // Let SQS retry
    }
  }
};
