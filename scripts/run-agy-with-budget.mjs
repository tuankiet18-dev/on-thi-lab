#!/usr/bin/env node

import fs from "node:fs";
import process from "node:process";
import { spawn } from "node:child_process";

const separator = process.argv.indexOf("--");
const options = process.argv.slice(2, separator);
const command = separator >= 0 ? process.argv.slice(separator + 1) : [];

const readOption = (name) => {
  const index = options.indexOf(name);
  return index >= 0 ? options[index + 1] : undefined;
};

const budget = Number(readOption("--budget"));
const stdoutPath = readOption("--stdout");
const stderrPath = readOption("--stderr");
if (
  !Number.isSafeInteger(budget) ||
  budget <= 0 ||
  !stdoutPath ||
  !stderrPath ||
  command.length === 0
) {
  console.error(
    "usage: run-agy-with-budget.mjs --budget N --stdout FILE --stderr FILE -- COMMAND [ARGS...]",
  );
  process.exit(2);
}

const stdoutFile = fs.createWriteStream(stdoutPath, { flags: "wx" });
const stderrFile = fs.createWriteStream(stderrPath, { flags: "wx" });
const child = spawn(command[0], command.slice(1), {
  stdio: ["ignore", "pipe", "pipe"],
});
const completedSteps = new Set();
let buffered = "";
let tokensUsed = 0;
let budgetExceeded = false;

const stopForBudget = () => {
  if (budgetExceeded || tokensUsed <= budget) return;
  budgetExceeded = true;
  stderrFile.write(
    `AGY_TOKEN_BUDGET_EXCEEDED used=${tokensUsed} budget=${budget}\n`,
  );
  child.kill("SIGTERM");
  setTimeout(() => {
    if (child.exitCode === null && child.signalCode === null)
      child.kill("SIGKILL");
  }, 3000).unref();
};

const inspectLine = (line) => {
  if (!line.trim()) return;
  try {
    const event = JSON.parse(line);
    if (event.event === "step_update") {
      const step = event.step_update ?? {};
      if (step.state === "DONE" && !completedSteps.has(step.step_index)) {
        completedSteps.add(step.step_index);
        tokensUsed += Number(step.usage?.total_tokens ?? 0);
        stopForBudget();
      }
    } else if (event.event === "result") {
      tokensUsed = Math.max(
        tokensUsed,
        Number(event.result?.usage?.total_tokens ?? 0),
      );
      stopForBudget();
    }
  } catch {
    // The delegate validates the completed NDJSON stream and reports malformed output.
  }
};

child.stdout.on("data", (chunk) => {
  stdoutFile.write(chunk);
  buffered += chunk.toString("utf8");
  let newline;
  while ((newline = buffered.indexOf("\n")) >= 0) {
    inspectLine(buffered.slice(0, newline));
    buffered = buffered.slice(newline + 1);
  }
});
child.stderr.pipe(stderrFile);

child.on("error", (error) => {
  stderrFile.write(`${error.message}\n`);
});

child.on("close", (code, signal) => {
  if (buffered) inspectLine(buffered);
  stdoutFile.end();
  stderrFile.end();
  if (budgetExceeded) process.exit(75);
  if (signal) process.exit(1);
  process.exit(code ?? 1);
});
