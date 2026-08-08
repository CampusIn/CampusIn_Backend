const RAW_BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export const BASE_URL = RAW_BASE_URL.replace(/\/$/, "");
export const TEST_TYPE = (__ENV.TEST_TYPE || "load").toLowerCase();

const LOAD_STEP_TARGETS = [10, 25, 50, 100, 150, 200];

const parseIntEnv = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseBoolEnv = (value, fallback) => {
  if (value === undefined) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
};

const getLoadTarget = () => {
  const requested = parseIntEnv(__ENV.TARGET_VUS, LOAD_STEP_TARGETS[LOAD_STEP_TARGETS.length - 1]);

  if (requested <= 0) {
    return LOAD_STEP_TARGETS[LOAD_STEP_TARGETS.length - 1];
  }

  return requested;
};

const buildLoadStages = () => {
  const stageDuration = __ENV.LOAD_STAGE_DURATION || "1m";
  const rampDownDuration = __ENV.LOAD_RAMP_DOWN_DURATION || "2m";
  const target = getLoadTarget();

  const selectedTargets = LOAD_STEP_TARGETS.filter((value) => value <= target);
  if (selectedTargets.length === 0) {
    selectedTargets.push(target);
  }

  if (selectedTargets[selectedTargets.length - 1] !== target) {
    selectedTargets.push(target);
  }

  const stages = selectedTargets.map((value) => ({
    duration: stageDuration,
    target: value,
  }));

  stages.push({ duration: rampDownDuration, target: 0 });

  return stages;
};

const buildStressStages = () => {
  const stageDuration = __ENV.STRESS_STAGE_DURATION || "1m";
  const rampDownDuration = __ENV.STRESS_RAMP_DOWN_DURATION || "2m";

  return [
    { duration: stageDuration, target: 50 },
    { duration: stageDuration, target: 100 },
    { duration: stageDuration, target: 150 },
    { duration: stageDuration, target: 200 },
    { duration: stageDuration, target: 250 },
    { duration: stageDuration, target: 300 },
    { duration: rampDownDuration, target: 0 },
  ];
};

const buildSpikeStages = () => {
  const baselineDuration = __ENV.SPIKE_BASELINE_DURATION || "1m";
  const spikeDuration = __ENV.SPIKE_DURATION || "30s";
  const recoveryDuration = __ENV.SPIKE_RECOVERY_DURATION || "2m";

  return [
    { duration: baselineDuration, target: 20 },
    { duration: spikeDuration, target: 250 },
    { duration: recoveryDuration, target: 20 },
    { duration: "30s", target: 0 },
  ];
};

const buildSmokeStages = () => {
  return [
    { duration: __ENV.SMOKE_RAMP_UP_DURATION || "15s", target: 2 },
    { duration: __ENV.SMOKE_HOLD_DURATION || "30s", target: 5 },
    { duration: __ENV.SMOKE_RAMP_DOWN_DURATION || "15s", target: 0 },
  ];
};

const getStagesByProfile = () => {
  if (TEST_TYPE === "smoke") {
    return buildSmokeStages();
  }

  if (TEST_TYPE === "stress") {
    return buildStressStages();
  }

  if (TEST_TYPE === "spike") {
    return buildSpikeStages();
  }

  return buildLoadStages();
};

const DEFAULT_P95_MS = parseIntEnv(__ENV.THRESHOLD_P95_MS, 500);
const DEFAULT_P99_MS = parseIntEnv(__ENV.THRESHOLD_P99_MS, 1000);
const DEFAULT_ERROR_RATE = Number(__ENV.THRESHOLD_ERROR_RATE || 0.01);

export const USE_VU_IP_DISTRIBUTION = parseBoolEnv(
  __ENV.USE_VU_IP_DISTRIBUTION,
  true,
);

export const CART_WRITE_EVERY_N_ITER = parseIntEnv(__ENV.CART_WRITE_EVERY_N_ITER, 5);
export const ENABLE_CART_WRITES = parseBoolEnv(__ENV.ENABLE_CART_WRITES, false);

export const AUTH_TOKEN_TTL_MS = parseIntEnv(__ENV.AUTH_TOKEN_TTL_MS, 13 * 60 * 1000);
export const AUTH_REAUTH_COOLDOWN_MS = parseIntEnv(
  __ENV.AUTH_REAUTH_COOLDOWN_MS,
  30 * 1000,
);

export const jsonHeaders = {
  "Content-Type": "application/json",
};

export const getVirtualUserIp = () => {
  const vu = typeof __VU === "number" && __VU > 0 ? __VU : 1;
  const thirdOctet = Math.floor((vu - 1) / 250);
  const fourthOctet = ((vu - 1) % 250) + 1;
  return `10.254.${thirdOctet}.${fourthOctet}`;
};

export const withClientIpHeader = (headers = {}) => {
  if (!USE_VU_IP_DISTRIBUTION) {
    return headers;
  }

  return {
    ...headers,
    "x-forwarded-for": getVirtualUserIp(),
  };
};

export const sleepRange = (minSeconds, maxSeconds) => {
  if (maxSeconds <= minSeconds) {
    return minSeconds;
  }

  return minSeconds + Math.random() * (maxSeconds - minSeconds);
};

export const taggedParams = (scenario, operation, endpoint, extras = {}) => {
  return {
    ...extras,
    tags: {
      ...(extras.tags || {}),
      scenario,
      operation,
      endpoint,
      test_type: TEST_TYPE,
    },
  };
};

export const buildOptions = (scenario) => {
  return {
    stages: getStagesByProfile(),
    summaryTrendStats: ["avg", "p(90)", "p(95)", "p(99)"],
    thresholds: {
      http_req_failed: [`rate<${DEFAULT_ERROR_RATE}`],
      http_req_duration: [`p(95)<${DEFAULT_P95_MS}`, `p(99)<${DEFAULT_P99_MS}`],
      checks: ["rate>0.95"],
      [`http_req_duration{scenario:${scenario}}`]: [`p(95)<${DEFAULT_P95_MS}`, `p(99)<${DEFAULT_P99_MS}`],
      [`http_req_failed{scenario:${scenario}}`]: [`rate<${DEFAULT_ERROR_RATE}`],
    },
    tags: {
      scenario,
      test_type: TEST_TYPE,
    },
  };
};
