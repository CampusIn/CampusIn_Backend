import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, jsonHeaders } from "../config.js";

export const options = {
  vus: 1,
  iterations: 1,
  summaryTrendStats: ["avg", "p(90)", "p(95)", "p(99)"],
  tags: {
    scenario: "rate-limit",
    test_type: "rate-limit",
  },
};

export default function () {
  const email = __ENV.TEST_USER_EMAIL;
  const password = __ENV.TEST_USER_PASSWORD;

  if (!email || !password) {
    throw new Error("Missing TEST_USER_EMAIL / TEST_USER_PASSWORD for rate-limit scenario");
  }

  const headers = {
    ...jsonHeaders,
    "x-forwarded-for": __ENV.RATE_LIMIT_TEST_IP || "203.0.113.10",
  };

  for (let i = 1; i <= 7; i += 1) {
    const response = http.post(
      `${BASE_URL}/api/auth/user/login`,
      JSON.stringify({ email, password }),
      {
        headers,
        tags: {
          scenario: "rate-limit",
          operation: "strict_limiter_probe",
          endpoint: "/api/auth/user/login",
        },
      },
    );

    const body = (() => {
      try {
        return response.json();
      } catch (error) {
        return null;
      }
    })();

    const is429 = response.status === 429;
    const retryAfter = response.headers["Retry-After"] || response.headers["retry-after"];

    check(response, {
      "rate limit probe status captured": (res) => res.status >= 200,
    });

    if (is429) {
      console.log(
        `[rate-limit] hit strict limiter at attempt=${i} status=${response.status} retryAfter=${retryAfter || body?.retryAfter || "n/a"}`,
      );
    }

    sleep(0.2);
  }
}
