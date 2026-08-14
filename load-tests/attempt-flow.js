import http from "k6/http";
import { check, fail, sleep } from "k6";

const baseUrl = (__ENV.BASE_URL || "").replace(/\/$/, "");
const examId = __ENV.EXAM_ID || "";
// k6 resolves open() paths relative to this script, not the shell cwd.
const usersFile = __ENV.TEST_USERS_FILE || "./users.local.json";
const users = JSON.parse(open(usersFile));
const targetVus = Math.min(300, Math.max(1, Number(__ENV.TARGET_VUS || 100)));
const answerIntervalSeconds = Math.max(
  0.1,
  Number(__ENV.ANSWER_INTERVAL_SECONDS || 5),
);
const maxQuestions = Math.max(1, Number(__ENV.MAX_QUESTIONS || 60));

export const options = {
  scenarios: {
    exam_flow: {
      executor: "ramping-vus",
      stages: [
        { duration: __ENV.RAMP_UP || "2m", target: targetVus },
        { duration: __ENV.HOLD || "10m", target: targetVus },
        { duration: __ENV.RAMP_DOWN || "1m", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<2000"],
    "http_req_duration{name:autosave}": ["p(95)<1000"],
    "http_req_failed{name:submit}": ["rate<0.001"],
  },
};

function requestParams(user, name) {
  return {
    headers: {
      Authorization: `Bearer ${user.idToken}`,
      "Content-Type": "application/json",
    },
    tags: { name },
  };
}

function responseData(response, operation) {
  const valid = check(response, {
    [`${operation} succeeded`]: (result) =>
      result.status >= 200 && result.status < 300,
  });
  if (!valid) {
    fail(`${operation} failed with HTTP ${response.status}`);
  }
  return response.json("data");
}

export function setup() {
  if (!baseUrl || !examId) {
    fail("BASE_URL and EXAM_ID are required.");
  }
  if (!Array.isArray(users) || users.length < targetVus) {
    fail(`TEST_USERS_FILE must contain at least ${targetVus} staging users.`);
  }
  const uniqueTokens = new Set(
    users.slice(0, targetVus).map((user) => user.idToken),
  );
  if (uniqueTokens.size < targetVus) {
    fail("Each virtual user needs a different Cognito ID token.");
  }
}

export default function () {
  const user = users[(__VU - 1) % users.length];
  const params = requestParams(user, "catalog");
  http.get(`${baseUrl}/v1/catalog?limit=20`, params);

  const launch = responseData(
    http.post(
      `${baseUrl}/v1/attempts`,
      JSON.stringify({
        examId,
        deviceId: `load-test-${user.label || __VU}`,
      }),
      requestParams(user, "launch"),
    ),
    "launch",
  );
  const attempt = launch.attempt;
  const session = responseData(
    http.get(
      `${baseUrl}/v1/attempts/${attempt.id}/session`,
      requestParams(user, "session"),
    ),
    "session",
  );

  const questionIds = session.attempt.questionOrder.slice(0, maxQuestions);
  questionIds.forEach((questionId, index) => {
    const response = http.put(
      `${baseUrl}/v1/attempts/${attempt.id}/answers`,
      JSON.stringify({
        questionId,
        selectedOptions: [0],
        // The production client uses an incrementing counter. Keep the load
        // fixture within PostgreSQL's integer range while preserving the same
        // monotonic sequence invariant per attempt.
        sequence: index + 1,
      }),
      requestParams(user, "autosave"),
    );
    check(response, {
      "autosave succeeded": (result) => result.status === 200,
    });
    sleep(answerIntervalSeconds * (0.85 + Math.random() * 0.3));
  });

  const submission = http.post(
    `${baseUrl}/v1/attempts/${attempt.id}/submit`,
    JSON.stringify({ reason: "user" }),
    requestParams(user, "submit"),
  );
  check(submission, {
    "submit succeeded": (result) => result.status === 200,
  });
  sleep(1 + Math.random() * 2);
}
