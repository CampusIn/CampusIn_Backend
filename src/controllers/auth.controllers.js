import userModel from "../models/user.models.js";
import sessionModel from "../models/session.models.js";
import crypto from "crypto";
import bcrypt from "bcrypt";
import config from "../config/config.js";
import jwt from "jsonwebtoken";
import emailServices from "../services/emailQueue.services.js";
import otpServices from "../services/otp.services.js";
import redisServices from "../services/redis.services.js";
import { generateOTP, generateOtpHTML, generateWelcomeHTML,generateForgotPasswordHTML } from "../utils/utils.js";
import ApiError from "../utils/apiErrors.js";
import ApiResponse from "../utils/apiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import mongoose from "mongoose";
import { REDIS_KEYS } from "../constants/redis.constants.js";
import { assertAllowedEmailDomain } from "../utils/emailDomainWhitelist.utils.js";

const refreshTokenCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};
const clearRefreshTokenCookieOptions = {
  httpOnly: refreshTokenCookieOptions.httpOnly,
  secure: refreshTokenCookieOptions.secure,
  sameSite: refreshTokenCookieOptions.sameSite,
};

const getExpectedRole = (req) => req.authRole;

const ensureExpectedRole = (expectedRole, actualRole) => {
  if (expectedRole && expectedRole !== actualRole) {
    throw new ApiError(
      403,
      `This endpoint is only available for ${expectedRole} accounts`,
    );
  }
};

const register = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;
  const role = getExpectedRole(req) || "user";
  const normalizedEmail = email?.trim().toLowerCase();
  const normalizedUsername = username?.trim();

  if (!username || !email || !password) {
    throw new ApiError(400, "Username, email and password are required");
  }

  assertAllowedEmailDomain(normalizedEmail);

  const isUserExists = await userModel.findOne({
    $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
  });
  if (isUserExists) {
    throw new ApiError(409, "Username or email already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = await userModel.create({
    username: normalizedUsername,
    email: normalizedEmail,
    password: hashedPassword,
    role,
  });

  const otp = generateOTP();
  const otpHTML = generateOtpHTML(otp);
  await otpServices.storeOTP(normalizedEmail, otp);

  await emailServices.queueOTPEmail({
    to: normalizedEmail,
    subject: "Your OTP for CampusIn registration",
    text: "OTP for CampusIn registration. Only valid for 5 minutes",
    otpHtml: otpHTML,
  });

  res.status(201).json(
    new ApiResponse(
      201,
      "User registered successfully. Please verify your email",
      {
        username: normalizedUsername,
        email: normalizedEmail,
        verified: newUser.verified,
      },
    ),
  );
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const expectedRole = getExpectedRole(req);
  const normalizedEmail = email?.trim().toLowerCase();

  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  assertAllowedEmailDomain(normalizedEmail);

  const user = await userModel.findOne({
    email: normalizedEmail,
    ...(expectedRole ? { role: expectedRole } : {}),
  });
  if (!user) {
    throw new ApiError(400, "Invalid credentials");
  }

  if (!user.verified) {
    throw new ApiError(400, "Please verify your email before logging in");
  }

  if (!user.password) {
    throw new ApiError(400, "Please login with Google");
  }

  const isPasswordMatch = await bcrypt.compare(password, user.password);
  if (!isPasswordMatch) {
    throw new ApiError(400, "Invalid credentials");
  }

  const refreshToken = jwt.sign(
    {
      id: user._id,
      role: user.role,
    },
    config.JWT_SECRET,
    {
      expiresIn: "7d",
    },
  );

  const refreshTokenHash = await crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");
  const session = await sessionModel.create({
    user: user._id,
    refreshTokenHash,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });

  const accessToken = jwt.sign(
    {
      id: user._id,
      sessionId: session._id,
      role: user.role,
    },
    config.JWT_SECRET,
    {
      expiresIn: "15m",
    },
  );

  res.cookie("refreshToken", refreshToken, {
    ...refreshTokenCookieOptions,
  });

  res
    .status(200)
    .json(new ApiResponse(200, "Login successful", { accessToken }));
});

const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.cookies;
  const expectedRole = getExpectedRole(req);
  if (!refreshToken) {
    throw new ApiError(401, "Unauthorised, refresh token not found");
  }
  const refreshTokenHash = await crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");
  const decoded = jwt.verify(refreshToken, config.JWT_SECRET);
  const session = await sessionModel.findOne({
    refreshTokenHash,
    revoked: false,
  });
  const user = await userModel.findById(decoded.id);
  if (!user) {
    throw new ApiError(401, "User not found");
  }
  ensureExpectedRole(expectedRole, user.role);

  if (!session) {
    throw new ApiError(400, "No session in progress");
  }
  const newAccessToken = jwt.sign(
    {
      id: decoded.id,
      role: user.role,
    },
    config.JWT_SECRET,
    {
      expiresIn: "15m",
    },
  );

  const newRefeshToken = jwt.sign(
    {
      id: decoded.id,
      role: user.role,
    },
    config.JWT_SECRET,
    {
      expiresIn: "7d",
    },
  );

  const newRefreshTokenHash = await crypto
    .createHash("sha256")
    .update(newRefeshToken)
    .digest("hex");
  session.refreshTokenHash = newRefreshTokenHash;
  await session.save();
  res.cookie("refreshToken", newRefeshToken, {
    ...refreshTokenCookieOptions,
  });

  res.status(201).json(
    new ApiResponse(201, "New access token created", {
      accessToken: newAccessToken,
    }),
  );
});

const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.cookies;
  const expectedRole = getExpectedRole(req);
  if (!refreshToken) {
    res.clearCookie("refreshToken", clearRefreshTokenCookieOptions);
    return res.status(200).json(new ApiResponse(200, {}, "Logout successful"));
  }

  const decoded = jwt.verify(refreshToken, config.JWT_SECRET);
  ensureExpectedRole(expectedRole, decoded.role);

  const refreshTokenHash = await crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");
  const session = await sessionModel.findOne({
    refreshTokenHash,
    revoked: false,
  });
  if (!session) {
    throw new ApiError(400, "No session in progress");
  }
  session.revoked = true;
  await session.save();
  res.clearCookie("refreshToken", clearRefreshTokenCookieOptions);

  return res.status(200).json(new ApiResponse(200, {}, "Logout successful"));
});

const logoutAll = asyncHandler(async (req, res) => {
  const { refreshToken } = req.cookies;
  const expectedRole = getExpectedRole(req);
  if (!refreshToken) {
    res.clearCookie("refreshToken", clearRefreshTokenCookieOptions);
    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Logged out from all devices"));
  }
  const decoded = jwt.verify(refreshToken, config.JWT_SECRET);
  ensureExpectedRole(expectedRole, decoded.role);
  await sessionModel.updateMany(
    {
      user: decoded.id,
      revoked: false,
    },
    {
      revoked: true,
    },
  );

  res.clearCookie("refreshToken", clearRefreshTokenCookieOptions);
  return res.status(200).json(new ApiResponse(200, {}, "Logged out from all devices"));
});

const verifyEmail = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const expectedRole = getExpectedRole(req);
  const normalizedEmail = email?.trim().toLowerCase();

  if (!email || !otp) {
    throw new ApiError(400, "Email and OTP are required");
  }

  const verifyOTP = await otpServices.verifyOTP(normalizedEmail, otp)
  if(!verifyOTP){
    throw new ApiError(400,"OTP verification failed")
  }

  const user = await userModel.findOneAndUpdate(
    {
      email: normalizedEmail,
      ...(expectedRole ? { role: expectedRole } : {}),
    },
    { verified: true },
    { returnDocument: "after" },
  );
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  const refreshToken = jwt.sign(
    {
      id: user._id,
      role: user.role,
    },
    config.JWT_SECRET,
    {
      expiresIn: "7d",
    },
  );

  const refreshTokenHash = await crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");
  const session = await sessionModel.create({
    user: user._id,
    refreshTokenHash,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });
  const accessToken = jwt.sign(
    {
      id: user._id,
      role: user.role,
    },
    config.JWT_SECRET,
    {
      expiresIn: "15m",
    },
  );

  await emailServices.queueWelcomeEmail({
    to: normalizedEmail,
    subject: "Welcome to CAMPUSIN",
    text: "Welcome to CAMPUSIN. Your account is verified and ready to use.",
    welcomeHtml: generateWelcomeHTML(),
  })

  res.cookie("refreshToken", refreshToken, {
    ...refreshTokenCookieOptions,
  });
  return res.status(200).json(
    new ApiResponse(200, "Email verified successfully", {
      user: {
        username: user.username,
        email: user.email,
        verified: user.verified,
      },
      accessToken,
    }),
  );
});

const resendOTP = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const expectedRole = getExpectedRole(req);
  const normalizedEmail = email?.trim().toLowerCase();
  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  const user = await userModel.findOne({
    email: normalizedEmail,
    ...(expectedRole ? { role: expectedRole } : {}),
  });

  if (!user) {
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          "If the email is registered, an OTP will be sent",
          {},
        ),
      );
  }

  if (user.verified) {
    throw new ApiError(400, "Email is already verified");
  }

  const isCooldown = await redisServices.exists(`${REDIS_KEYS.COOLDOWN_KEY}:${normalizedEmail}`)

  if(isCooldown){
    throw new ApiError(429, "Please wait 60 seconds before requesting a new OTP");
  }

  await redisServices.set(`${REDIS_KEYS.COOLDOWN_KEY}:${normalizedEmail}`,'1',60)



  const otp = generateOTP();
  const otpHTML = generateOtpHTML(otp);
  await otpServices.storeOTP(normalizedEmail,otp)

  await emailServices.queueOTPEmail({
    to:normalizedEmail,
    subject:"Hey, didn't you verify your email yet? Here's your OTP",
    text:"Please use the following OTP to verify your email:",
    otpHtml:otpHTML
  })
  

  return res.status(200).json(new ApiResponse(200, "OTP resent successfully"));
});

const forgotPassword = asyncHandler(async(req,res)=>{
  const {email} = req.body
  const expectedRole = getExpectedRole(req);
  if(!email){
    throw new ApiError(400,"User email is required")
  }
  const normalisedEmail = email.trim().toLowerCase()
  const user = await userModel.findOne({
    email:normalisedEmail,
    verified:true,
    ...(expectedRole ? { role: expectedRole } : {}),
  })

  if(!user){
    return res.status(200).json(new ApiResponse(200,"If an account exists with this email, an OTP has been sent."))
  }
  const otp = generateOTP()
  const forgotHtml = generateForgotPasswordHTML(otp)
  await otpServices.storeOTP(normalisedEmail,otp)
  await emailServices.queueForgotEmail({
    to:normalisedEmail,
    subject:"Forgot your password? It happens.",
    text:"Email regarding your password reset for CampusIn",
    forgotHtml
  })

  return res.status(200).json(new ApiResponse(200,"If an account exists with this email, an OTP has been sent."))


});

const verifyResetOtp = asyncHandler(async(req,res)=>{
  const {email,otp} = req.body
  const expectedRole = getExpectedRole(req);
  if(!otp){
    throw new ApiError(400,"OTP is missing")
  }
  if(!email){
    throw new ApiError(400,"User email is required")
  }
  const normalisedEmail = email.trim().toLowerCase()

  const user = await userModel.findOne({
    email:normalisedEmail,
    verified:true,
    ...(expectedRole ? { role: expectedRole } : {}),
  })
  if(!user){
    throw new ApiError(404,"Invalid OTP or email")
  }

  const isVerified = await otpServices.verifyOTP(normalisedEmail,otp)
  if(!isVerified){
    throw new ApiError(400,"OTP verification failed")
  }

  const resetToken = crypto.randomBytes(32).toString('hex')
  await redisServices.set(`${REDIS_KEYS.RESET}:${resetToken}`,user._id.toString(),600)

  return res.status(200).json(new ApiResponse(200,"Reset token set successfully",{
    resetToken
  }))

});

const resetPassword = asyncHandler(async(req,res)=>{
  const{resetToken,password}= req.body
  if(!password){
    throw new ApiError(400,"New password is not enetered")
  }

  const userId = await redisServices.get(`${REDIS_KEYS.RESET}:${resetToken}`)
  if(!userId){
    throw new ApiError(400,"User ID not found")
  }

  const user = await userModel.findById(userId)
  if(!user){
    throw new ApiError(404,"Invalid Request")
  }
  const hashedPassword = await bcrypt.hash(password,10)
  user.password = hashedPassword
  await user.save()
  await redisServices.remove(`${REDIS_KEYS.REQUEST}:${resetToken}`)
  await sessionModel.deleteMany({
    user:user._id
  })

  return res.status(200).json(new ApiResponse(200,"Password reset is successfull. Log in again to continue"))


});

const googleLogin = asyncHandler(async (req, res) => {
  const user = req.user;

  const refreshToken = jwt.sign(
    {
      id: user._id,
      role: user.role,
    },
    config.JWT_SECRET,
    {
      expiresIn: "7d",
    },
  );

  const refreshTokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  const session = await sessionModel.create({
    user: user._id,
    refreshTokenHash,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });

  const accessToken = jwt.sign(
    {
      id: user._id,
      sessionId: session._id,
      role: user.role,
    },
    config.JWT_SECRET,
    {
      expiresIn: "15m",
    },
  );

  res.cookie("refreshToken", refreshToken, {
    ...refreshTokenCookieOptions,
  });
  return res.redirect(`${config.CLIENT_URL}/auth/success?token=${accessToken}`);
});

const getMe = asyncHandler(async (req, res) => {
  const user = await userModel.findById(req.user.id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  res.status(200).json(
    new ApiResponse(200, "User profile retrieved", {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
    }),
  );
});

const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }
  const { username } = req.body;
  const updateData = {};
  if (username) {
    const existingUser = await userModel.findOne({
      username,
      _id: { $ne: userId },
    });
    if (existingUser) {
      throw new ApiError(400, "Username already exists");
    }

    updateData.username = username;
  }
  const updatedUser = await userModel.findByIdAndUpdate(userId, updateData, {
    new: true,
  });
  if (!updatedUser) {
    throw new ApiError(404, "User not found");
  }
  res.status(200).json(
    new ApiResponse(200, "Profile updated successfully", {
      id: updatedUser._id,
      username: updatedUser.username,
      email: updatedUser.email,
      role: updatedUser.role,
    }),
  );
});

export default {
  register,
  refreshToken,
  logout,
  logoutAll,
  login,
  verifyEmail,
  googleLogin,
  getMe,
  updateProfile,
  resendOTP,
  forgotPassword,
  verifyResetOtp,
  resetPassword
};
