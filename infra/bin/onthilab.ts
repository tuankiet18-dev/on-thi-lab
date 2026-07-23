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
const callbackUrls =
  stage === "dev"
    ? ["http://localhost:5173/auth/callback"]
    : [`https://app.onthilab.vn/auth/callback`];
const logoutUrls =
  stage === "dev" ? ["http://localhost:5173/"] : ["https://app.onthilab.vn/"];

const environment = {
  account,
  region,
};

new OnThiLabAuthStack(app, `OnThiLabAuth-${stage}`, {
  env: environment,
  stage,
  domainPrefix,
  callbackUrls,
  logoutUrls,
  description: `OnThiLab ${stage} authentication`,
});

new OnThiLabStack(app, `OnThiLab-${stage}`, {
  env: {
    account,
    region,
  },
  stage,
  description: `OnThiLab ${stage} serverless foundation`,
});
