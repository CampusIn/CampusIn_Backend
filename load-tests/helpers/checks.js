import { check } from "k6";
import { Counter } from "k6/metrics";

export const rateLimit429 = new Counter("rate_limit_429");
export const httpFailuresByOperation = new Counter("http_failures_by_operation");

const loggedFailureKeys = new Set();

const sanitizeText = (value, maxLen = 1200) => {
  return String(value || "")
    .replace(/"accessToken"\s*:\s*"[^"]*"/g, '"accessToken":"[REDACTED]"')
    .replace(/"refreshToken"\s*:\s*"[^"]*"/g, '"refreshToken":"[REDACTED]"')
    .replace(/"password"\s*:\s*"[^"]*"/g, '"password":"[REDACTED]"')
    .replace(/"authorization"\s*:\s*"[^"]*"/gi, '"authorization":"[REDACTED]"')
    .replace(/"cookie"\s*:\s*"[^"]*"/gi, '"cookie":"[REDACTED]"')
    .slice(0, maxLen);
};

const buildFailureKey = ({ scenario, operation, method, url, status, reason }) => {
  const vu = typeof __VU === "number" ? __VU : 0;
  const iter = typeof __ITER === "number" ? __ITER : 0;
  return [scenario, operation, method, url, status, vu, iter, reason].join("|");
};

export const logHttpFailure = ({
  response,
  expectedStatuses = [],
  metricTags = {},
  resultName = "request",
  requestInfo = {},
  reason = "unexpected_response",
}) => {
  const scenario = metricTags.scenario || requestInfo.scenario || "unknown";
  const operation = metricTags.operation || requestInfo.operation || resultName;
  const endpoint = metricTags.endpoint || requestInfo.endpoint || "unknown";
  const method = requestInfo.method || response.request?.method || "unknown";
  const url = response.request?.url || requestInfo.path || "unknown";
  const status = Number(response.status || 0);
  const expectedStatus = expectedStatuses.join("|") || "n/a";
  const vu =
    metricTags.vu ||
    String(typeof __VU === "number" && __VU > 0 ? __VU : 0);
  const iteration = String(typeof __ITER === "number" ? __ITER : 0);
  const userPoolIndex = metricTags.user_pool_index || "n/a";
  const requestPayload = sanitizeText(requestInfo.requestPayload || response.request?.body || "", 600);
  const responseBody = sanitizeText(response.body || "", 1400);
  const timestamp = new Date().toISOString();
  const tagsLine = sanitizeText(JSON.stringify(metricTags || {}), 500);

  const failureKey = buildFailureKey({
    scenario,
    operation,
    method,
    url,
    status,
    reason,
  });

  if (loggedFailureKeys.has(failureKey)) {
    return;
  }
  loggedFailureKeys.add(failureKey);

  const failureMetricTags = {
    scenario,
    operation,
    endpoint,
    status: String(status),
    method,
    reason,
    vu,
    user_pool_index: String(userPoolIndex),
  };

  if (metricTags.test_type !== undefined && metricTags.test_type !== null) {
    failureMetricTags.test_type = String(metricTags.test_type);
  }

  httpFailuresByOperation.add(1, failureMetricTags);

  check(response, {
    [`http_failure status=${status} operation=${operation} endpoint=${endpoint}`]: () => false,
  });

  console.error(
    [
      "[HTTP FAILURE]",
      `timestamp=${timestamp}`,
      `scenario=${scenario}`,
      `operation=${operation}`,
      `endpoint=${endpoint}`,
      `reason=${reason}`,
      `expected_status=${expectedStatus}`,
      `actual_status=${status}`,
      `method=${method}`,
      `vu=${vu}`,
      `iteration=${iteration}`,
      `user_pool_index=${userPoolIndex}`,
      `url=${url}`,
      `tags=${tagsLine}`,
      `request_payload=${requestPayload}`,
      `response=${responseBody}`,
    ].join("\n"),
  );
};

export const pickRandom = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  const index = Math.floor(Math.random() * items.length);
  return items[index];
};

export const checkResponse = (
  response,
  {
    name,
    expectedStatuses = [200],
    requireSuccess = true,
    requireJson = true,
    requireData = false,
    metricTags = {},
    requestInfo = {},
  } = {},
) => {
  const resultName = name || "request";
  const statusOk = expectedStatuses.includes(response.status);
  let failureAlreadyLogged = false;
  const checks = {
    [`${resultName} status expected`]: () => statusOk,
  };

  if (requireJson) {
    checks[`${resultName} is json`] = (res) => {
      const contentType =
        res.headers["Content-Type"] ||
        res.headers["content-type"] ||
        "";

      return contentType.includes("application/json");
    };
  }

  check(response, checks);

  if (!statusOk) {
    logHttpFailure({
      response,
      expectedStatuses,
      metricTags,
      resultName,
      requestInfo,
      reason: "unexpected_status",
    });
    failureAlreadyLogged = true;
  }

  let json;
  try {
    json = response.json();
  } catch (error) {
    if (requireJson) {
      check(response, {
        [`${resultName} parse json`]: () => false,
      });
      logHttpFailure({
        response,
        expectedStatuses,
        metricTags,
        resultName,
        requestInfo,
        reason: "invalid_json",
      });
      failureAlreadyLogged = true;
    }
    return null;
  }

  const retryAfterHeader =
    response.headers["Retry-After"] || response.headers["retry-after"];
  const isRateLimited =
    response.status === 429 &&
    (Boolean(retryAfterHeader) ||
      Boolean(json?.retryAfter) ||
      json?.statusCode === 429);

  if (isRateLimited) {
    rateLimit429.add(1, {
      check_name: resultName,
      ...metricTags,
    });
  }

  if (requireSuccess) {
    const successOk = Boolean(json && json.success === true);
    check(json, {
      [`${resultName} success true`]: () => successOk,
    });

    if (!successOk && !failureAlreadyLogged) {
      logHttpFailure({
        response,
        expectedStatuses,
        metricTags,
        resultName,
        requestInfo,
        reason: "success_flag_false",
      });
      failureAlreadyLogged = true;
    }
  }

  if (requireData) {
    const dataOk = Boolean(json && json.data !== undefined);
    check(json, {
      [`${resultName} has data`]: () => dataOk,
    });

    if (!dataOk && !failureAlreadyLogged) {
      logHttpFailure({
        response,
        expectedStatuses,
        metricTags,
        resultName,
        requestInfo,
        reason: "missing_data",
      });
      failureAlreadyLogged = true;
    }
  }

  return json;
};
