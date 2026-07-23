#!/usr/bin/env node
import "source-map-support/register.js";
import { App } from "aws-cdk-lib";
import { OnThiLabStack } from "../lib/onthilab-stack.js";

const app = new App();
const stage = app.node.tryGetContext("stage") ?? "dev";

new OnThiLabStack(app, `OnThiLab-${stage}`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "ap-southeast-1",
  },
  stage,
  description: `OnThiLab ${stage} serverless foundation`,
});
