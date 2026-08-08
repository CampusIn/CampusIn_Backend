import http from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";
import {
  AUTH_REAUTH_COOLDOWN_MS,
  AUTH_TOKEN_TTL_MS,
  BASE_URL,
  jsonHeaders,
  taggedParams,
  withClientIpHeader,
} from "../config.js";
import { checkResponse } from "./checks.js";

const ROLE_CONFIG = {
  user: {
    loginPath: "/api/auth/user/login",
    emailEnv: "TEST_USER_EMAIL",
    emailsEnv: "TEST_USER_EMAILS",
    passwordEnv: "TEST_USER_PASSWORD",
    passwordsEnv: "TEST_USER_PASSWORDS",
  },
  vendor: {
    loginPath: "/api/auth/vendor/login",
    emailEnv: "TEST_VENDOR_EMAIL",
    emailsEnv: "TEST_VENDOR_EMAILS",
    passwordEnv: "TEST_VENDOR_PASSWORD",
    passwordsEnv: "TEST_VENDOR_PASSWORDS",
  },
  admin: {
    loginPath: "/api/auth/admin/login",
    emailEnv: "TEST_ADMIN_EMAIL",
    emailsEnv: "TEST_ADMIN_EMAILS",
    passwordEnv: "TEST_ADMIN_PASSWORD",
    passwordsEnv: "TEST_ADMIN_PASSWORDS",
  },
  delivery: {
    loginPath: "/api/auth/delivery-partner/login",
    emailEnv: "TEST_DELIVERY_EMAIL",
    emailsEnv: "TEST_DELIVERY_EMAILS",
    passwordEnv: "TEST_DELIVERY_PASSWORD",
    passwordsEnv: "TEST_DELIVERY_PASSWORDS",
  },
};

const tokenCacheByRole = {};
const authLogins = new Counter("auth_logins_total");

const parseCsvList = (raw) => {
  if (!raw) {
    return [];
  }

  return String(raw)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseUserJsonPool = () => {
  const raw = __ENV.TEST_USERS_JSON;
  if (!raw) {
    return [];
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error("Invalid TEST_USERS_JSON value. Provide valid JSON array.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Invalid TEST_USERS_JSON value. Expected an array of user objects.");
  }

  return parsed
    .map((entry) => {
      const email = String(entry?.email || "").trim();
      const password = String(entry?.password || "").trim();
      return { email, password };
    })
    .filter((entry) => entry.email);
};

const getRoleConfig = (role) => {
  const config = ROLE_CONFIG[role];
  if (!config) {
    throw new Error(`Unsupported auth role: ${role}`);
  }

  return config;
};

const getCredentialPool = (role) => {
  const roleConfig = getRoleConfig(role);

  if (role === "user") {
    const jsonPool = parseUserJsonPool();
    if (jsonPool.length > 0) {
      const sharedPassword = String(__ENV[roleConfig.passwordEnv] || "").trim();
      const pool = jsonPool.map((entry) => ({
        email: entry.email,
        password: entry.password || sharedPassword,
      }));

      if (pool.some((entry) => !entry.password)) {
        throw new Error(
          "Missing password in TEST_USERS_JSON entries. Provide per-user password or set TEST_USER_PASSWORD.",
        );
      }

      return { pool, source: "TEST_USERS_JSON" };
    }
  }

  const emailList = parseCsvList(__ENV[roleConfig.emailsEnv]);
  const passwordList = parseCsvList(__ENV[roleConfig.passwordsEnv]);
  const sharedEmail = String(__ENV[roleConfig.emailEnv] || "").trim();
  const sharedPassword = String(__ENV[roleConfig.passwordEnv] || "").trim();

  if (emailList.length > 0) {
    const pool = emailList.map((email, index) => {
      const password = passwordList[index] || (passwordList.length === 1 ? passwordList[0] : "") || sharedPassword;
      return {
        email,
        password,
      };
    });

    if (pool.some((entry) => !entry.password)) {
      throw new Error(
        `Missing password for ${role} credential pool. Set ${roleConfig.passwordEnv} or provide ${roleConfig.passwordsEnv} for each email.`,
      );
    }

    return { pool, source: roleConfig.emailsEnv };
  }

  if (!sharedEmail || !sharedPassword) {
    throw new Error(
      `Missing credentials for role ${role}. Set ${roleConfig.emailEnv}/${roleConfig.passwordEnv} or ${roleConfig.emailsEnv}/${roleConfig.passwordsEnv}.`,
    );
  }

  return {
    pool: [{ email: sharedEmail, password: sharedPassword }],
    source: `${roleConfig.emailEnv}/${roleConfig.passwordEnv}`,
  };
};

const selectCredential = (role) => {
  const { pool, source } = getCredentialPool(role);
  const vuIndex = typeof __VU === "number" && __VU > 0 ? __VU - 1 : 0;
  const poolIndex = vuIndex % pool.length;
  const selected = pool[poolIndex];

  if (!selected?.email || !selected?.password) {
    throw new Error(`Invalid credential selection for role ${role}.`);
  }

  return {
    email: selected.email,
    password: selected.password,
    poolIndex,
    poolSize: pool.length,
    source,
  };
};

const getCacheKey = (role, credentialSelection) => {
  return `${role}:${credentialSelection.poolIndex}`;
};

export const getCredentialSelection = (role) => {
  const selection = selectCredential(role);
  return {
    poolIndex: selection.poolIndex,
    poolSize: selection.poolSize,
    source: selection.source,
    vu: typeof __VU === "number" && __VU > 0 ? __VU : 0,
  };
};

export const getCredentialPoolInfo = (role) => {
  const { pool, source } = getCredentialPool(role);
  return {
    size: pool.length,
    source,
  };
};

const login = (role, scenario, credentialSelection) => {
  const roleConfig = getRoleConfig(role);
  const credentials = {
    email: credentialSelection.email,
    password: credentialSelection.password,
  };

  const response = http.post(
    `${BASE_URL}${roleConfig.loginPath}`,
    JSON.stringify(credentials),
    taggedParams(
      scenario,
      `${role}_login`,
      roleConfig.loginPath,
      { headers: withClientIpHeader(jsonHeaders) },
    ),
  );

  const body = checkResponse(response, {
    name: `${role} login`,
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
    metricTags: {
      scenario,
      operation: `${role}_login`,
      endpoint: roleConfig.loginPath,
      vu: String(typeof __VU === "number" && __VU > 0 ? __VU : 0),
      user_pool_index: String(credentialSelection.poolIndex + 1),
    },
    requestInfo: {
      scenario,
      operation: `${role}_login`,
      endpoint: roleConfig.loginPath,
      method: "POST",
      path: roleConfig.loginPath,
      requestPayload: JSON.stringify(credentials),
    },
  });

  const token = body?.data?.accessToken;

  check(body, {
    [`${role} login token present`]: (parsed) => Boolean(parsed?.data?.accessToken),
  });

  if (!token) {
    throw new Error(`Login response for role ${role} did not include data.accessToken`);
  }

  authLogins.add(1, {
    role,
    scenario,
    vu: String(typeof __VU === "number" && __VU > 0 ? __VU : 0),
    user_pool_index: String(credentialSelection.poolIndex + 1),
  });

  const now = Date.now();
  tokenCacheByRole[getCacheKey(role, credentialSelection)] = {
    token,
    expiresAt: now + AUTH_TOKEN_TTL_MS,
    lastLoginAt: now,
  };

  return token;
};

export const getAuthToken = (
  role,
  { force = false, scenario = "auth", credentialSelection = null } = {},
) => {
  const selection = credentialSelection || selectCredential(role);
  const cacheKey = getCacheKey(role, selection);
  const cached = tokenCacheByRole[cacheKey];
  if (!force && cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  return login(role, scenario, selection);
};

export const authRequest = ({ role, scenario, method, path, body = null, params = {} }) => {
  const credentialSelection = selectCredential(role);
  let token = getAuthToken(role, { scenario, credentialSelection });
  const endpoint = params.tags?.endpoint || path.split("?")[0];
  const payload = body ? (typeof body === "string" ? body : JSON.stringify(body)) : null;
  const requestTags = {
    ...(params.tags || {}),
    vu: String(typeof __VU === "number" && __VU > 0 ? __VU : 0),
    user_pool_index: String(credentialSelection.poolIndex + 1),
  };

  const execute = (jwt) => {
    const headers = {
      ...(payload ? jsonHeaders : {}),
      ...(params.headers || {}),
      Authorization: `Bearer ${jwt}`,
    };

    const requestHeaders = withClientIpHeader(headers);

      return http.request(
        method,
        `${BASE_URL}${path}`,
        payload,
        taggedParams(scenario, requestTags.operation || "authed_request", endpoint, {
          ...params,
          tags: requestTags,
          headers: requestHeaders,
        }),
      );
  };

  let response = execute(token);

  if (response.status === 401) {
    const cacheKey = getCacheKey(role, credentialSelection);
    const cached = tokenCacheByRole[cacheKey];
    const now = Date.now();
    const shouldReauth =
      !cached?.lastForcedLoginAt || now - cached.lastForcedLoginAt > AUTH_REAUTH_COOLDOWN_MS;

    if (shouldReauth) {
      token = getAuthToken(role, { force: true, scenario, credentialSelection });

      tokenCacheByRole[cacheKey] = {
        ...tokenCacheByRole[cacheKey],
        lastForcedLoginAt: now,
      };

      response = execute(token);
    }
  }

  return response;
};

export const loginUser = () => getAuthToken("user", { scenario: "auth" });
export const loginVendor = () => getAuthToken("vendor", { scenario: "auth" });
export const loginAdmin = () => getAuthToken("admin", { scenario: "auth" });
export const loginDelivery = () => getAuthToken("delivery", { scenario: "auth" });
