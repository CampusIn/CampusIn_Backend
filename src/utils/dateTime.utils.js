const IST_TIME_ZONE = "Asia/Kolkata";
const IST_UTC_OFFSET = "+05:30";
const EXPLICIT_TIMEZONE_REGEX = /(?:Z|[+-]\d{2}:?\d{2})$/i;
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const hasExplicitTimezone = (value) =>
  typeof value === "string" && EXPLICIT_TIMEZONE_REGEX.test(value.trim());

const parseIstDateTime = (value) => {
  if (value instanceof Date) {
    return value;
  }

  if (value === null || value === undefined || value === "") {
    return new Date(NaN);
  }

  if (typeof value === "number") {
    return new Date(value);
  }

  if (typeof value !== "string") {
    return new Date(value);
  }

  const trimmed = value.trim();

  // Strings with an explicit timezone already carry an unambiguous instant.
  if (hasExplicitTimezone(trimmed)) {
    return new Date(trimmed);
  }

  // Timezone-less input (e.g. a datetime-local field) is treated as IST.
  const normalized = trimmed.replace(" ", "T");
  if (DATE_ONLY_REGEX.test(normalized)) {
    return new Date(`${normalized}T00:00:00${IST_UTC_OFFSET}`);
  }

  const withTime = /T\d{2}:\d{2}/.test(normalized)
    ? normalized
    : `${normalized}T00:00`;
  const withSeconds = /T\d{2}:\d{2}:\d{2}/.test(withTime)
    ? withTime
    : `${withTime}:00`;

  return new Date(`${withSeconds}${IST_UTC_OFFSET}`);
};

const formatIstDateTime = (value) => {
  const date = value instanceof Date ? value : parseIstDateTime(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const formatted = new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);

  return `${formatted} IST`;
};

export { IST_TIME_ZONE, IST_UTC_OFFSET, parseIstDateTime, formatIstDateTime };
