#!/usr/bin/env node
import "source-map-support/register.js";
import { App } from "aws-cdk-lib";
import { OnThiLabAuthStack } from "../lib/auth-stack.js";
import { OnThiLabStack } from "../lib/onthilab-stack.js";

const app = new App();
const stage = app.node.tryGetContext("stage") ?? "dev";
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION ?? "ap-southeast-1";
const domainPrefix =
  app.node.tryGetContext("cognitoDomainPrefix") ??
  `onthilab-${stage}-${account ?? "local"}`;
const databaseParameterName = app.node.tryGetContext("databaseParameterName");
const webDomainName = app.node.tryGetContext("webDomainName");
const webCertificateArn = app.node.tryGetContext("webCertificateArn");
const webBaseUrl =
  app.node.tryGetContext("webBaseUrl") ??
  (stage === "dev"
    ? "http://localhost:5173"
    : stage === "prod"
      ? "https://onthilab.id.vn"
      : undefined);

if (
  stage === "prod" &&
  (!databaseParameterName || !webDomainName || !webCertificateArn)
) {
  throw new Error(
    "Production requires databaseParameterName, webDomainName and webCertificateArn CDK context values.",
  );
}
if (!webBaseUrl) {
  throw new Error("Non-development stages require webBaseUrl CDK context.");
}

const callbackUrls = [new URL("/auth/callback", webBaseUrl).toString()];
const logoutUrls = [new URL("/", webBaseUrl).toString()];

const environment = {
  account,
  region,
};

const authStack = new OnThiLabAuthStack(app, `OnThiLabAuth-${stage}`, {
  env: environment,
  stage,
  domainPrefix,
  callbackUrls,
  logoutUrls,
  googleClientIdParameterName: `/onthilab/${stage}/google/client-id`,
  googleClientSecretParameterName: `/onthilab/${stage}/google/client-secret`,
  description: `OnThiLab ${stage} authentication`,
});

new OnThiLabStack(app, `OnThiLab-${stage}`, {
  env: {
    account,
    region,
  },
  stage,
  cognitoUserPoolId: authStack.userPool.userPoolId,
  cognitoClientId: authStack.userPoolClient.userPoolClientId,
  databaseParameterName,
  webDomainName,
  webCertificateArn,
  description: `OnThiLab ${stage} serverless foundation`,
});
