import crypto from "crypto";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/apiErrors.js";
import ApiResponse from "../utils/apiResponse.js";
import luckyDrawModel from "../models/luckyDraw.models.js";
import luckyDrawEntryModel from "../models/luckyDrawEntry.models.js";

const normalizePhoneNumber = (phoneInput) => {
  if (!phoneInput) {
    return "";
  }
  return String(phoneInput).trim().replace(/[\s\-()]/g, "");
};

const validateInputCredentials = (name, mobileNumber) => {
  if (!name || name.length < 2) {
    throw new ApiError(400, "A valid user name is required");
  }

  if (!mobileNumber || !/^\+?[0-9]{10,15}$/.test(mobileNumber)) {
    throw new ApiError(400, "A valid 10-15 digit mobile number is required");
  }
};

const verifySubmissionWindow = (luckyDraw) => {
  if (!luckyDraw) {
    throw new ApiError(400, "Lucky draw submissions are currently closed");
  }

  const now = Date.now();
  const deadline = new Date(luckyDraw.submissionDeadline).getTime();
  if (now > deadline) {
    throw new ApiError(400, "Lucky draw submission deadline has passed");
  }
};

const verifyNoDuplicateEntry = async (luckyDrawId, mobileNumber, userId) => {
  const existingMobileEntry = await luckyDrawEntryModel.findOne({
    luckyDraw: luckyDrawId,
    mobileNumber,
  });

  if (existingMobileEntry) {
    throw new ApiError(
      409,
      "This mobile number has already been entered into the lucky draw",
    );
  }

  if (userId) {
    const existingUserEntry = await luckyDrawEntryModel.findOne({
      luckyDraw: luckyDrawId,
      user: userId,
    });

    if (existingUserEntry) {
      throw new ApiError(
        409,
        "You have already submitted an entry for this lucky draw",
      );
    }
  }
};

const selectRandomWinners = (entries, winnerCount) => {
  const pool = [...entries];
  const count = Math.min(winnerCount, pool.length);
  const selectedWinners = [];

  for (let i = 0; i < count; i++) {
    const randomIndex = crypto.randomInt(0, pool.length);
    const [winner] = pool.splice(randomIndex, 1);
    selectedWinners.push({
      entry: winner._id,
      user: winner.user || null,
      name: winner.name,
      mobileNumber: winner.mobileNumber,
      wonAt: new Date(),
    });
  }

  return selectedWinners;
};

// ================= USER CONTROLLERS =================

const submitEntry = asyncHandler(async (req, res) => {
  const rawName = req.body.name ?? req.body.userName;
  const rawMobile = req.body.mobileNumber ?? req.body.phone ?? req.body.phoneNumber;

  const name = String(rawName || "").trim();
  const mobileNumber = normalizePhoneNumber(rawMobile);

  validateInputCredentials(name, mobileNumber);

  const luckyDraw = await luckyDrawModel
    .findOne({ isActive: true, isOver: false })
    .sort({ createdAt: -1 });

  verifySubmissionWindow(luckyDraw);

  await verifyNoDuplicateEntry(luckyDraw._id, mobileNumber, req.user?.id);

  const entry = await luckyDrawEntryModel.create({
    luckyDraw: luckyDraw._id,
    user: req.user?.id || null,
    name,
    mobileNumber,
    submittedAt: new Date(),
  });

  return res.status(201).json(
    new ApiResponse(201, "Lucky draw entry submitted successfully", {
      entryId: entry._id,
      name: entry.name,
      submittedAt: entry.submittedAt,
    }),
  );
});

const getUserWinners = asyncHandler(async (req, res) => {
  const { luckyDrawId } = req.query;

  const query = luckyDrawId ? { _id: luckyDrawId } : { isOver: true };
  const luckyDraw = await luckyDrawModel
    .findOne(query)
    .sort({ drawnAt: -1, updatedAt: -1 });

  if (!luckyDraw || !luckyDraw.isOver) {
    return res.status(200).json(
      new ApiResponse(200, "Lucky draw has not been conducted yet", {
        isOver: false,
        winners: [],
      }),
    );
  }

  // Users can ONLY see the winner names (strictly no phone number)
  const publicWinners = (luckyDraw.winners || []).map((w) => ({
    name: w.name,
    wonAt: w.wonAt,
  }));

  return res.status(200).json(
    new ApiResponse(200, "Lucky draw winners fetched successfully", {
      luckyDrawId: luckyDraw._id,
      title: luckyDraw.title,
      isOver: true,
      drawnAt: luckyDraw.drawnAt,
      totalWinners: publicWinners.length,
      winners: publicWinners,
    }),
  );
});

const getUserLuckyDrawStatus = asyncHandler(async (req, res) => {
  const activeDraw = await luckyDrawModel
    .findOne({ isActive: true, isOver: false })
    .sort({ createdAt: -1 });

  if (!activeDraw) {
    const lastDraw = await luckyDrawModel
      .findOne({ isOver: true })
      .sort({ drawnAt: -1, updatedAt: -1 });

    return res.status(200).json(
      new ApiResponse(200, "No active lucky draw submissions", {
        isActive: false,
        isOver: Boolean(lastDraw?.isOver),
        lastDrawId: lastDraw?._id || null,
        canSubmit: false,
      }),
    );
  }

  const now = Date.now();
  const deadline = new Date(activeDraw.submissionDeadline).getTime();
  const canSubmit = Boolean(activeDraw.isActive && !activeDraw.isOver && now <= deadline);

  return res.status(200).json(
    new ApiResponse(200, "Lucky draw status fetched successfully", {
      luckyDrawId: activeDraw._id,
      title: activeDraw.title,
      description: activeDraw.description,
      submissionDeadline: activeDraw.submissionDeadline,
      isActive: activeDraw.isActive,
      isOver: activeDraw.isOver,
      canSubmit,
    }),
  );
});

// ================= ADMIN CONTROLLERS =================

const enableLuckyDraw = asyncHandler(async (req, res) => {
  const {
    submissionDeadline,
    title = "Campus Lucky Draw",
    numberOfWinners = 1,
    description = "",
    closePrevious = true,
  } = req.body;

  const deadline = new Date(submissionDeadline);
  if (Number.isNaN(deadline.getTime()) || deadline.getTime() <= Date.now()) {
    throw new ApiError(
      400,
      "Submission deadline must be a valid future date and time",
    );
  }

  if (closePrevious) {
    await luckyDrawModel.updateMany(
      { isActive: true, isOver: false },
      { $set: { isActive: false, status: "CLOSED" } },
    );
  }

  const luckyDraw = await luckyDrawModel.create({
    title,
    description,
    submissionDeadline: deadline,
    numberOfWinners: Number(numberOfWinners) || 1,
    isActive: true,
    status: "ACTIVE",
    isOver: false,
    createdBy: req.user?.id || null,
  });

  return res.status(201).json(
    new ApiResponse(201, "Lucky draw submissions enabled successfully", {
      luckyDrawId: luckyDraw._id,
      title: luckyDraw.title,
      description: luckyDraw.description,
      submissionDeadline: luckyDraw.submissionDeadline,
      numberOfWinners: luckyDraw.numberOfWinners,
      isActive: luckyDraw.isActive,
      status: luckyDraw.status,
    }),
  );
});

const updateLuckyDrawDeadline = asyncHandler(async (req, res) => {
  const { submissionDeadline, luckyDrawId } = req.body;

  const query = luckyDrawId
    ? { _id: luckyDrawId }
    : { isActive: true, isOver: false };

  const luckyDraw = await luckyDrawModel
    .findOne(query)
    .sort({ createdAt: -1 });

  if (!luckyDraw) {
    throw new ApiError(404, "Active lucky draw not found");
  }

  if (luckyDraw.isOver) {
    throw new ApiError(
      400,
      "Cannot update submission deadline for an already completed lucky draw",
    );
  }

  const deadline = new Date(submissionDeadline);
  if (Number.isNaN(deadline.getTime()) || deadline.getTime() <= Date.now()) {
    throw new ApiError(
      400,
      "Submission deadline must be a valid future date and time",
    );
  }

  luckyDraw.submissionDeadline = deadline;
  luckyDraw.isActive = true;
  luckyDraw.status = "ACTIVE";
  await luckyDraw.save();

  return res.status(200).json(
    new ApiResponse(200, "Lucky draw deadline updated successfully", {
      luckyDrawId: luckyDraw._id,
      title: luckyDraw.title,
      submissionDeadline: luckyDraw.submissionDeadline,
      isActive: luckyDraw.isActive,
      status: luckyDraw.status,
    }),
  );
});

const drawLuckyWinners = asyncHandler(async (req, res) => {
  const { luckyDrawId, winnerCount } = req.body;

  const query = luckyDrawId
    ? { _id: luckyDrawId }
    : { isOver: false };

  const luckyDraw = await luckyDrawModel
    .findOne(query)
    .sort({ createdAt: -1 });

  if (!luckyDraw) {
    throw new ApiError(404, "No uncompleted lucky draw found to conduct");
  }

  if (luckyDraw.isOver) {
    throw new ApiError(400, "Lucky draw has already been conducted");
  }

  const entries = await luckyDrawEntryModel.find({ luckyDraw: luckyDraw._id });

  if (entries.length === 0) {
    throw new ApiError(400, "No participants have entered this lucky draw");
  }

  const requestedCount = Number(winnerCount) || luckyDraw.numberOfWinners || 1;
  const count = Math.max(1, requestedCount);

  // Full random cryptographic selection
  const selectedWinners = selectRandomWinners(entries, count);

  luckyDraw.winners = selectedWinners;
  luckyDraw.isOver = true;
  luckyDraw.isActive = false;
  luckyDraw.status = "COMPLETED";
  luckyDraw.drawnAt = new Date();
  luckyDraw.drawnBy = req.user?.id || null;
  await luckyDraw.save();

  // Admin gets BOTH user name and phone number
  const adminWinners = selectedWinners.map((w) => ({
    entryId: w.entry,
    name: w.name,
    mobileNumber: w.mobileNumber,
    wonAt: w.wonAt,
  }));

  return res.status(200).json(
    new ApiResponse(200, "Lucky draw conducted successfully", {
      luckyDrawId: luckyDraw._id,
      title: luckyDraw.title,
      drawnAt: luckyDraw.drawnAt,
      totalParticipants: entries.length,
      totalWinners: adminWinners.length,
      winners: adminWinners,
    }),
  );
});

const getAdminLuckyDrawWinners = asyncHandler(async (req, res) => {
  const { luckyDrawId } = req.query;

  const query = luckyDrawId ? { _id: luckyDrawId } : { isOver: true };
  const luckyDraw = await luckyDrawModel
    .findOne(query)
    .sort({ drawnAt: -1, updatedAt: -1 });

  if (!luckyDraw) {
    throw new ApiError(404, "Lucky draw not found");
  }

  if (!luckyDraw.isOver) {
    return res.status(200).json(
      new ApiResponse(200, "Lucky draw has not been conducted yet", {
        luckyDrawId: luckyDraw._id,
        title: luckyDraw.title,
        isOver: false,
        winners: [],
      }),
    );
  }

  // Admin sees BOTH phone number and user name
  const adminWinners = (luckyDraw.winners || []).map((w) => ({
    entryId: w.entry,
    name: w.name,
    mobileNumber: w.mobileNumber,
    wonAt: w.wonAt,
  }));

  return res.status(200).json(
    new ApiResponse(200, "Lucky draw winners fetched successfully", {
      luckyDrawId: luckyDraw._id,
      title: luckyDraw.title,
      isOver: luckyDraw.isOver,
      drawnAt: luckyDraw.drawnAt,
      totalWinners: adminWinners.length,
      winners: adminWinners,
    }),
  );
});

const getAdminLuckyDrawParticipants = asyncHandler(async (req, res) => {
  const { luckyDrawId, page = 1, limit = 20, search } = req.query;
  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 20);

  const drawQuery = luckyDrawId
    ? { _id: luckyDrawId }
    : {};

  const luckyDraw = await luckyDrawModel
    .findOne(drawQuery)
    .sort({ createdAt: -1 });

  if (!luckyDraw) {
    throw new ApiError(404, "Lucky draw not found");
  }

  const filter = { luckyDraw: luckyDraw._id };
  if (search && String(search).trim()) {
    const searchRegex = new RegExp(String(search).trim(), "i");
    filter.$or = [
      { name: searchRegex },
      { mobileNumber: searchRegex },
    ];
  }

  const [participants, totalParticipants] = await Promise.all([
    luckyDrawEntryModel
      .find(filter)
      .sort({ submittedAt: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .lean(),
    luckyDrawEntryModel.countDocuments(filter),
  ]);

  return res.status(200).json(
    new ApiResponse(200, "Participants fetched successfully", {
      luckyDrawId: luckyDraw._id,
      title: luckyDraw.title,
      totalParticipants,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(totalParticipants / limitNumber),
      participants: participants.map((p) => ({
        entryId: p._id,
        name: p.name,
        mobileNumber: p.mobileNumber,
        submittedAt: p.submittedAt,
        user: p.user,
      })),
    }),
  );
});

const getAdminLuckyDrawDetails = asyncHandler(async (req, res) => {
  const { luckyDrawId } = req.query;

  const query = luckyDrawId ? { _id: luckyDrawId } : {};
  const luckyDraw = await luckyDrawModel
    .findOne(query)
    .sort({ createdAt: -1 });

  if (!luckyDraw) {
    throw new ApiError(404, "Lucky draw not found");
  }

  const totalParticipants = await luckyDrawEntryModel.countDocuments({
    luckyDraw: luckyDraw._id,
  });

  return res.status(200).json(
    new ApiResponse(200, "Lucky draw details fetched successfully", {
      luckyDrawId: luckyDraw._id,
      title: luckyDraw.title,
      description: luckyDraw.description,
      submissionDeadline: luckyDraw.submissionDeadline,
      isActive: luckyDraw.isActive,
      status: luckyDraw.status,
      isOver: luckyDraw.isOver,
      drawnAt: luckyDraw.drawnAt,
      numberOfWinners: luckyDraw.numberOfWinners,
      totalParticipants,
      winners: (luckyDraw.winners || []).map((w) => ({
        entryId: w.entry,
        name: w.name,
        mobileNumber: w.mobileNumber,
        wonAt: w.wonAt,
      })),
    }),
  );
});

export default {
  submitEntry,
  getUserWinners,
  getUserLuckyDrawStatus,
  enableLuckyDraw,
  updateLuckyDrawDeadline,
  drawLuckyWinners,
  getAdminLuckyDrawWinners,
  getAdminLuckyDrawParticipants,
  getAdminLuckyDrawDetails,
};
