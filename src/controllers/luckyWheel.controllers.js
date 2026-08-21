import crypto from "crypto";
import mongoose from "mongoose";
import ApiError from "../utils/apiErrors.js";
import ApiResponse from "../utils/apiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import luckyWheelConfig from "../config/luckyWheel.config.js";
import couponModel from "../models/coupon.models.js";
import luckyWheelSpinModel from "../models/luckyWheelSpin.models.js";
import { deleteCouponCached } from "../services/couponCached.services.js";

const COUPON_CODE_PREFIX = "CW";
const COUPON_CODE_RANDOM_LENGTH = 6;

const validateEventConfig = () => {
  if (
    !(luckyWheelConfig.startsAt instanceof Date) ||
    Number.isNaN(luckyWheelConfig.startsAt.getTime())
  ) {
    throw new ApiError(500, "Lucky wheel start time is invalid");
  }

  if (
    !(luckyWheelConfig.endsAt instanceof Date) ||
    Number.isNaN(luckyWheelConfig.endsAt.getTime())
  ) {
    throw new ApiError(500, "Lucky wheel end time is invalid");
  }

  const totalProbability = luckyWheelConfig.prizes.reduce(
    (total, prize) => total + Number(prize.probability || 0),
    0,
  );

  if (totalProbability !== 100) {
    throw new ApiError(500, "Lucky wheel prize configuration is invalid");
  }
};

const ensureEventIsActive = () => {
  const now = new Date();

  if (now < luckyWheelConfig.startsAt) {
    throw new ApiError(400, "The Freshers Lucky Wheel has not started yet.");
  }

  if (now > luckyWheelConfig.endsAt) {
    throw new ApiError(400, "The Freshers Lucky Wheel has ended.");
  }
};

const selectWeightedPrize = () => {
  const randomValue = Math.random() * 100;
  let cumulative = 0;

  for (const prize of luckyWheelConfig.prizes) {
    cumulative += Number(prize.probability);
    if (randomValue < cumulative) {
      return prize;
    }
  }

  return luckyWheelConfig.prizes[luckyWheelConfig.prizes.length - 1];
};

const generateCouponCode = () => {
  const randomPart = crypto
    .randomBytes(COUPON_CODE_RANDOM_LENGTH)
    .toString("base64")
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase()
    .slice(0, COUPON_CODE_RANDOM_LENGTH);

  return `${COUPON_CODE_PREFIX}-${randomPart}`;
};

const getLuckyWheelCouponExpiry = () => {
  const expiry = new Date(luckyWheelConfig.endsAt);
  expiry.setDate(expiry.getDate() + Math.max(1, luckyWheelConfig.couponExpiryDays));
  return expiry;
};

const createPersonalCoupon = async ({ prize, userId, session }) => {
  const expiryDate = getLuckyWheelCouponExpiry();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateCouponCode();

    try {
      const [coupon] = await couponModel.create(
        [
          {
            code,
            discountType: prize.discountType,
            discountValue: prize.discountValue,
            minimumOrderValue: prize.minimumOrderValue || 0,
            maximumDiscount:
              prize.discountType === "PERCENTAGE"
                ? prize.maximumDiscount || prize.discountValue
                : 0,
            expiryDate,
            usageLimit: 1,
            createdBy: userId,
            type: "personal",
            assignedTo: userId,
            source: "lucky_wheel",
          },
        ],
        { session },
      );

      return coupon;
    } catch (error) {
      if (error?.code === 11000) {
        continue;
      }

      throw error;
    }
  }

  throw new ApiError(500, "Could not generate a unique coupon code");
};

const formatSpinResult = (spin) => {
  const coupon = spin?.coupon
    ? {
        code: spin.coupon.code,
        couponId: spin.coupon._id,
        discountType: spin.coupon.discountType,
        discountValue: spin.coupon.discountValue,
        expiryDate: spin.coupon.expiryDate,
      }
    : null;

  return {
    prize: spin.prizeLabel,
    prizeId: spin.prizeId,
    coupon,
  };
};

const getLuckyWheelStatus = asyncHandler(async (req, res) => {
  const spin = await luckyWheelSpinModel
    .findOne({
      user: req.user.id,
      eventId: luckyWheelConfig.eventId,
    })
    .populate({
      path: "coupon",
      select: "code discountType discountValue expiryDate",
    });

  if (!spin) {
    return res
      .status(200)
      .json(new ApiResponse(200, "Lucky wheel status fetched successfully", {
        canSpin: true,
        result: null,
      }));
  }

  return res
    .status(200)
    .json(new ApiResponse(200, "Lucky wheel status fetched successfully", {
      canSpin: false,
      result: formatSpinResult(spin),
    }));
});

const spinLuckyWheel = asyncHandler(async (req, res) => {
  validateEventConfig();
  ensureEventIsActive();

  const existingSpin = await luckyWheelSpinModel.findOne({
    user: req.user.id,
    eventId: luckyWheelConfig.eventId,
  });

  if (existingSpin) {
    throw new ApiError(409, "You have already spun the wheel.");
  }

  const prize = selectWeightedPrize();
  const session = await mongoose.startSession();

  let spin;

  try {
    session.startTransaction();

    let coupon = null;
    if (prize.type === "discount") {
      coupon = await createPersonalCoupon({
        prize,
        userId: req.user.id,
        session,
      });
    }

    [spin] = await luckyWheelSpinModel.create(
      [
        {
          user: req.user.id,
          eventId: luckyWheelConfig.eventId,
          prizeId: prize.id,
          prizeLabel: prize.label,
          prizeType: prize.type,
          coupon: coupon?._id || null,
          spunAt: new Date(),
        },
      ],
      { session },
    );

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();

    if (error?.code === 11000) {
      throw new ApiError(409, "You have already spun the wheel.");
    }

    const alreadySpun = await luckyWheelSpinModel.exists({
      user: req.user.id,
      eventId: luckyWheelConfig.eventId,
    });

    if (alreadySpun) {
      throw new ApiError(409, "You have already spun the wheel.");
    }

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(500, "Unable to spin the wheel right now. Please try again.");
  } finally {
    session.endSession();
  }

  await deleteCouponCached();

  const populatedSpin = await luckyWheelSpinModel.findById(spin._id).populate({
    path: "coupon",
    select: "code discountType discountValue expiryDate",
  });

  return res
    .status(201)
    .json(new ApiResponse(201, "Lucky wheel spin completed successfully", {
      canSpin: false,
      result: formatSpinResult(populatedSpin),
    }));
});

export default {
  getLuckyWheelStatus,
  spinLuckyWheel,
};
