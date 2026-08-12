import crypto from "crypto";

const requestIdMiddleware = (req, res, next) => {
  const incomingRequestId = req.headers["x-request-id"];
  const safeIncomingRequestId =
    typeof incomingRequestId === "string" && incomingRequestId.trim()
      ? incomingRequestId.trim().slice(0, 128)
      : null;

  const requestId = safeIncomingRequestId || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  next();
};

export default requestIdMiddleware;
