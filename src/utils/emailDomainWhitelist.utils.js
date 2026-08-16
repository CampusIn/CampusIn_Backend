import allowedEmailDomains from "../config/emailDomainWhitelist.config.js";
import ApiError from "./apiErrors.js";

const normalizeEmailDomain = (domain) => domain.trim().toLowerCase();

const getEmailDomain = (email) => {
  if (!email || typeof email !== "string") {
    return "";
  }

  const [, domain = ""] = email.trim().toLowerCase().split("@");
  return normalizeEmailDomain(domain);
};

const isAllowedEmailDomain = (email) => {
  const emailDomain = getEmailDomain(email);
  const normalizedAllowedDomains = allowedEmailDomains.map(normalizeEmailDomain);

  if (
    normalizedAllowedDomains.length === 0 ||
    normalizedAllowedDomains.includes("*")
  ) {
    return true;
  }

  return normalizedAllowedDomains.includes(emailDomain);
};

const assertAllowedEmailDomain = (email) => {
  if (!isAllowedEmailDomain(email)) {
    throw new ApiError(
      403,
      `Email registration/login is only allowed for: ${allowedEmailDomains
        .map((domain) => `@${domain}`)
        .join(", ")}`,
    );
  }
};

export { getEmailDomain, isAllowedEmailDomain, assertAllowedEmailDomain };
