import type { SQSEvent, SQSHandler } from "aws-lambda";
import {
  createDatabaseConnection,
  PostgresOcrRepository,
} from "@onthilab/database";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import {
  processOcrJob,
  type TextOcrClient,
  type TextOcrResult,
} from "./ocr-processor.js";

const databaseParameterName = process.env.DATABASE_PARAMETER_NAME;
const textOcrFunctionName = process.env.TEXT_OCR_FUNCTION_NAME;

if (!databaseParameterName || !textOcrFunctionName) {
  throw new Error("Missing required environment variables for worker.");
}

const ssmClient = new SSMClient({});
const lambdaClient = new LambdaClient({});
const maxOcrDeliveryAttempts = 3;

class LambdaTextOcrClient implements TextOcrClient {
  constructor(private readonly functionName: string) {}

  async read(imageKey: string): Promise<TextOcrResult> {
    const response = await lambdaClient.send(
      new InvokeCommand({
        FunctionName: this.functionName,
        Payload: new TextEncoder().encode(JSON.stringify({ key: imageKey })),
      }),
    );
    // The function reports its own failures as needs_review; FunctionError means it crashed or timed out.
    if (response.FunctionError) {
      throw new Error(`Text OCR function failed: ${response.FunctionError}`);
    }
    return JSON.parse(
      new TextDecoder().decode(response.Payload),
    ) as TextOcrResult;
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
      const dbConnection = createDatabaseConnection(connectionString, {
        maxConnections: 1,
      });
      return new PostgresOcrRepository(dbConnection.db);
    })();
  }
  return ocrRepositoryPromise;
}

const textOcr = new LambdaTextOcrClient(textOcrFunctionName);

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
        ocr: textOcr,
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
