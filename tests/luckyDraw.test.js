import { jest } from "@jest/globals";

const luckyDrawModelMock = {
  findOne: jest.fn(),
  findById: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  updateMany: jest.fn(),
};

const luckyDrawEntryModelMock = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  countDocuments: jest.fn(),
};

jest.unstable_mockModule("../src/models/luckyDraw.models.js", () => ({
  default: luckyDrawModelMock,
}));

jest.unstable_mockModule("../src/models/luckyDrawEntry.models.js", () => ({
  default: luckyDrawEntryModelMock,
}));

let luckyDrawControllers;
let validators;

beforeAll(async () => {
  const [controllerMod, validatorMod] = await Promise.all([
    import("../src/controllers/luckyDraw.controllers.js"),
    import("../src/validators/luckyDraw.validators.js"),
  ]);
  luckyDrawControllers = controllerMod.default;
  validators = validatorMod;
});

beforeEach(() => {
  jest.clearAllMocks();
});

const createMockRes = () => {
  const res = {};
  res.statusCode = 200;
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((data) => {
    res.data = data;
    return res;
  });
  return res;
};

const runController = (fn, req, res = createMockRes()) => {
  return new Promise((resolve) => {
    const next = (err) => {
      resolve({ err, res });
    };
    const origJson = res.json;
    res.json = (data) => {
      origJson(data);
      resolve({ err: null, res });
      return res;
    };
    try {
      fn(req, res, next);
    } catch (err) {
      resolve({ err, res });
    }
  });
};

describe("Lucky Draw Controller Unit Tests", () => {
  const futureDate = (hours = 24) =>
    new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  const pastDate = (hours = 24) =>
    new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  describe("Admin - enableLuckyDraw", () => {
    it("should allow admin to enable a lucky draw with a future deadline", async () => {
      const deadline = futureDate(48);
      const req = {
        user: { id: "admin-1", role: "admin" },
        body: {
          title: "Campus Festival Lucky Draw",
          description: "Big prizes",
          submissionDeadline: deadline,
          numberOfWinners: 3,
        },
      };

      luckyDrawModelMock.updateMany.mockResolvedValue({ modifiedCount: 1 });
      luckyDrawModelMock.create.mockResolvedValue({
        _id: "draw-1",
        title: "Campus Festival Lucky Draw",
        description: "Big prizes",
        submissionDeadline: new Date(deadline),
        numberOfWinners: 3,
        isActive: true,
        status: "ACTIVE",
      });

      const { err, res } = await runController(
        luckyDrawControllers.enableLuckyDraw,
        req,
      );

      expect(err).toBeNull();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.data.success).toBe(true);
      expect(res.data.data.title).toBe("Campus Festival Lucky Draw");
      expect(luckyDrawModelMock.updateMany).toHaveBeenCalledWith(
        { isActive: true, isOver: false },
        { $set: { isActive: false, status: "CLOSED" } },
      );
      expect(luckyDrawModelMock.create).toHaveBeenCalled();
    });

    it("should reject enabling with past deadline", async () => {
      const req = {
        user: { id: "admin-1", role: "admin" },
        body: {
          submissionDeadline: pastDate(2),
        },
      };

      const { err } = await runController(
        luckyDrawControllers.enableLuckyDraw,
        req,
      );

      expect(err).toBeTruthy();
      expect(err.statusCode).toBe(400);
      expect(err.message).toMatch(/future date/i);
    });
  });

  describe("Admin - updateLuckyDrawDeadline", () => {
    it("should update deadline for active lucky draw", async () => {
      const newDeadline = futureDate(72);
      const mockDraw = {
        _id: "draw-1",
        title: "Campus Draw",
        submissionDeadline: new Date(futureDate(24)),
        isOver: false,
        isActive: true,
        status: "ACTIVE",
        save: jest.fn().mockResolvedValue(true),
      };

      luckyDrawModelMock.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockDraw),
      });

      const req = {
        body: { submissionDeadline: newDeadline },
      };

      const { err, res } = await runController(
        luckyDrawControllers.updateLuckyDrawDeadline,
        req,
      );

      expect(err).toBeNull();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockDraw.save).toHaveBeenCalled();
      expect(mockDraw.submissionDeadline).toEqual(new Date(newDeadline));
    });

    it("should reject updating deadline for completed lucky draw", async () => {
      const mockDraw = {
        _id: "draw-1",
        isOver: true,
      };

      luckyDrawModelMock.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockDraw),
      });

      const req = {
        body: { submissionDeadline: futureDate(48) },
      };

      const { err } = await runController(
        luckyDrawControllers.updateLuckyDrawDeadline,
        req,
      );

      expect(err).toBeTruthy();
      expect(err.statusCode).toBe(400);
      expect(err.message).toMatch(/already completed/i);
    });
  });

  describe("User - submitEntry", () => {
    it("should accept name and mobileNumber explicitly and save to db", async () => {
      const mockActiveDraw = {
        _id: "draw-1",
        submissionDeadline: new Date(futureDate(12)),
        isActive: true,
        isOver: false,
      };

      luckyDrawModelMock.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockActiveDraw),
      });

      luckyDrawEntryModelMock.findOne.mockResolvedValue(null);
      luckyDrawEntryModelMock.create.mockResolvedValue({
        _id: "entry-101",
        luckyDraw: "draw-1",
        user: "user-123",
        name: "Joel Eapen",
        mobileNumber: "9876543210",
        submittedAt: new Date(),
      });

      const req = {
        user: { id: "user-123", role: "user" },
        body: {
          name: "Joel Eapen",
          mobileNumber: "9876543210",
        },
      };

      const { err, res } = await runController(
        luckyDrawControllers.submitEntry,
        req,
      );

      expect(err).toBeNull();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.data.success).toBe(true);
      expect(res.data.data.name).toBe("Joel Eapen");
      expect(luckyDrawEntryModelMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          luckyDraw: "draw-1",
          user: "user-123",
          name: "Joel Eapen",
          mobileNumber: "9876543210",
        }),
      );
    });

    it("should accept phone and userName aliases and clean up phone format", async () => {
      const mockActiveDraw = {
        _id: "draw-1",
        submissionDeadline: new Date(futureDate(12)),
        isActive: true,
        isOver: false,
      };

      luckyDrawModelMock.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockActiveDraw),
      });

      luckyDrawEntryModelMock.findOne.mockResolvedValue(null);
      luckyDrawEntryModelMock.create.mockResolvedValue({
        _id: "entry-102",
        name: "Test User",
        mobileNumber: "+919876543210",
        submittedAt: new Date(),
      });

      const req = {
        user: { id: "user-456", role: "user" },
        body: {
          userName: "Test User",
          phone: "+91 98765-43210",
        },
      };

      const { err, res } = await runController(
        luckyDrawControllers.submitEntry,
        req,
      );

      expect(err).toBeNull();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(luckyDrawEntryModelMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Test User",
          mobileNumber: "+919876543210",
        }),
      );
    });

    it("should reject submission if no active lucky draw exists", async () => {
      luckyDrawModelMock.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(null),
      });

      const req = {
        body: { name: "Alice", mobileNumber: "9876543210" },
      };

      const { err } = await runController(
        luckyDrawControllers.submitEntry,
        req,
      );

      expect(err).toBeTruthy();
      expect(err.statusCode).toBe(400);
      expect(err.message).toMatch(/closed/i);
    });

    it("should reject submission after deadline has passed", async () => {
      const mockExpiredDraw = {
        _id: "draw-1",
        submissionDeadline: new Date(pastDate(1)),
        isActive: true,
        isOver: false,
      };

      luckyDrawModelMock.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockExpiredDraw),
      });

      const req = {
        body: { name: "Bob", mobileNumber: "9876543211" },
      };

      const { err } = await runController(
        luckyDrawControllers.submitEntry,
        req,
      );

      expect(err).toBeTruthy();
      expect(err.statusCode).toBe(400);
      expect(err.message).toMatch(/deadline has passed/i);
    });

    it("should reject duplicate mobile number in same draw", async () => {
      const mockActiveDraw = {
        _id: "draw-1",
        submissionDeadline: new Date(futureDate(12)),
        isActive: true,
        isOver: false,
      };

      luckyDrawModelMock.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockActiveDraw),
      });

      luckyDrawEntryModelMock.findOne.mockResolvedValueOnce({
        _id: "entry-existing",
        mobileNumber: "9876543210",
      });

      const req = {
        body: { name: "Charlie", mobileNumber: "9876543210" },
      };

      const { err } = await runController(
        luckyDrawControllers.submitEntry,
        req,
      );

      expect(err).toBeTruthy();
      expect(err.statusCode).toBe(409);
      expect(err.message).toMatch(/mobile number has already been entered/i);
    });

    it("should reject duplicate submission by authenticated user", async () => {
      const mockActiveDraw = {
        _id: "draw-1",
        submissionDeadline: new Date(futureDate(12)),
        isActive: true,
        isOver: false,
      };

      luckyDrawModelMock.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockActiveDraw),
      });

      luckyDrawEntryModelMock.findOne
        .mockResolvedValueOnce(null) // mobile check passed
        .mockResolvedValueOnce({ _id: "entry-user", user: "user-123" }); // user check failed

      const req = {
        user: { id: "user-123" },
        body: { name: "Dave", mobileNumber: "9876543212" },
      };

      const { err } = await runController(
        luckyDrawControllers.submitEntry,
        req,
      );

      expect(err).toBeTruthy();
      expect(err.statusCode).toBe(409);
      expect(err.message).toMatch(/already submitted an entry/i);
    });
  });

  describe("Admin - drawLuckyWinners (Full Random)", () => {
    it("should conduct lucky draw, select random winners, and provide name and phone to admin", async () => {
      const mockDraw = {
        _id: "draw-1",
        title: "Campus Lucky Draw",
        numberOfWinners: 2,
        isOver: false,
        winners: [],
        save: jest.fn().mockResolvedValue(true),
      };

      luckyDrawModelMock.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockDraw),
      });

      const participants = [
        { _id: "p1", name: "Alice", mobileNumber: "9876543210" },
        { _id: "p2", name: "Bob", mobileNumber: "9876543211" },
        { _id: "p3", name: "Charlie", mobileNumber: "9876543212" },
        { _id: "p4", name: "David", mobileNumber: "9876543213" },
      ];

      luckyDrawEntryModelMock.find.mockResolvedValue(participants);

      const req = {
        user: { id: "admin-1", role: "admin" },
        body: { winnerCount: 2 },
      };

      const { err, res } = await runController(
        luckyDrawControllers.drawLuckyWinners,
        req,
      );

      expect(err).toBeNull();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockDraw.save).toHaveBeenCalled();
      expect(mockDraw.isOver).toBe(true);
      expect(mockDraw.status).toBe("COMPLETED");

      // Admin response contains BOTH name and mobileNumber
      const winners = res.data.data.winners;
      expect(winners).toHaveLength(2);
      expect(winners[0].name).toBeDefined();
      expect(winners[0].mobileNumber).toBeDefined();
      expect(winners[1].name).toBeDefined();
      expect(winners[1].mobileNumber).toBeDefined();
    });

    it("should reject draw if no participants exist", async () => {
      const mockDraw = {
        _id: "draw-1",
        isOver: false,
      };

      luckyDrawModelMock.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockDraw),
      });

      luckyDrawEntryModelMock.find.mockResolvedValue([]);

      const req = {
        user: { id: "admin-1" },
        body: {},
      };

      const { err } = await runController(
        luckyDrawControllers.drawLuckyWinners,
        req,
      );

      expect(err).toBeTruthy();
      expect(err.statusCode).toBe(400);
      expect(err.message).toMatch(/no participants/i);
    });

    it("should reject draw if already completed", async () => {
      const mockDraw = {
        _id: "draw-1",
        isOver: true,
      };

      luckyDrawModelMock.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockDraw),
      });

      const req = {
        user: { id: "admin-1" },
        body: {},
      };

      const { err } = await runController(
        luckyDrawControllers.drawLuckyWinners,
        req,
      );

      expect(err).toBeTruthy();
      expect(err.statusCode).toBe(400);
      expect(err.message).toMatch(/already been conducted/i);
    });
  });

  describe("Winner Visibility - User Privacy (Name Only) vs Admin (Name & Phone)", () => {
    it("users should see name ONLY (strictly no phone number)", async () => {
      const mockCompletedDraw = {
        _id: "draw-1",
        title: "Campus Lucky Draw",
        isOver: true,
        drawnAt: new Date(),
        winners: [
          {
            entry: "p1",
            name: "Alice Winner",
            mobileNumber: "9876543210",
            wonAt: new Date(),
          },
          {
            entry: "p2",
            name: "Bob Winner",
            mobileNumber: "9876543211",
            wonAt: new Date(),
          },
        ],
      };

      luckyDrawModelMock.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockCompletedDraw),
      });

      const req = { query: {} };

      const { err, res } = await runController(
        luckyDrawControllers.getUserWinners,
        req,
      );

      expect(err).toBeNull();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.data.data.isOver).toBe(true);

      const winners = res.data.data.winners;
      expect(winners).toHaveLength(2);

      // Verify privacy: NAME ONLY, NO phone numbers
      for (const w of winners) {
        expect(w.name).toBeDefined();
        expect(w.mobileNumber).toBeUndefined();
        expect(w.phone).toBeUndefined();
        expect(w.phoneNumber).toBeUndefined();
      }
    });

    it("admin should see BOTH name and mobile number", async () => {
      const mockCompletedDraw = {
        _id: "draw-1",
        title: "Campus Lucky Draw",
        isOver: true,
        drawnAt: new Date(),
        winners: [
          {
            entry: "p1",
            name: "Alice Winner",
            mobileNumber: "9876543210",
            wonAt: new Date(),
          },
        ],
      };

      luckyDrawModelMock.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockCompletedDraw),
      });

      const req = { query: {} };

      const { err, res } = await runController(
        luckyDrawControllers.getAdminLuckyDrawWinners,
        req,
      );

      expect(err).toBeNull();
      expect(res.status).toHaveBeenCalledWith(200);
      const winners = res.data.data.winners;
      expect(winners).toHaveLength(1);
      expect(winners[0].name).toBe("Alice Winner");
      expect(winners[0].mobileNumber).toBe("9876543210");
    });

    it("should return empty winners when lucky draw is not over", async () => {
      luckyDrawModelMock.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(null),
      });

      const req = { query: {} };

      const { err, res } = await runController(
        luckyDrawControllers.getUserWinners,
        req,
      );

      expect(err).toBeNull();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.data.data.isOver).toBe(false);
      expect(res.data.data.winners).toEqual([]);
    });
  });

  describe("Status and Participants Inspection", () => {
    it("should return active status and submission window", async () => {
      const mockActiveDraw = {
        _id: "draw-1",
        title: "Campus Draw",
        submissionDeadline: new Date(futureDate(10)),
        isActive: true,
        isOver: false,
      };

      luckyDrawModelMock.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockActiveDraw),
      });

      const req = {};

      const { err, res } = await runController(
        luckyDrawControllers.getUserLuckyDrawStatus,
        req,
      );

      expect(err).toBeNull();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.data.data.canSubmit).toBe(true);
      expect(res.data.data.isActive).toBe(true);
    });

    it("should allow admin to inspect participants with pagination", async () => {
      const mockDraw = { _id: "draw-1", title: "Campus Draw" };
      luckyDrawModelMock.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockDraw),
      });

      const mockEntries = [
        {
          _id: "e1",
          name: "Participant 1",
          mobileNumber: "9876543210",
          submittedAt: new Date(),
        },
      ];

      luckyDrawEntryModelMock.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(mockEntries),
            }),
          }),
        }),
      });

      luckyDrawEntryModelMock.countDocuments.mockResolvedValue(1);

      const req = { query: { page: 1, limit: 10 } };

      const { err, res } = await runController(
        luckyDrawControllers.getAdminLuckyDrawParticipants,
        req,
      );

      expect(err).toBeNull();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.data.data.totalParticipants).toBe(1);
      expect(res.data.data.participants[0].name).toBe("Participant 1");
      expect(res.data.data.participants[0].mobileNumber).toBe("9876543210");
    });
  });

  describe("Lucky Draw Validators", () => {
    const runValidator = async (rules, req) => {
      let thrownError = null;
      for (const rule of rules) {
        await new Promise((resolve) => {
          try {
            rule(req, {}, (err) => {
              if (err) {
                thrownError = err;
              }
              resolve();
            });
          } catch (err) {
            thrownError = err;
            resolve();
          }
        });
        if (thrownError) {
          break;
        }
      }
      return thrownError;
    };

    it("enableLuckyDrawValidationRules should accept valid payload and reject invalid", async () => {
      const validReq = {
        body: {
          submissionDeadline: futureDate(24),
          title: "Campus Draw",
          numberOfWinners: 2,
        },
      };
      const validErr = await runValidator(
        validators.enableLuckyDrawValidationRules,
        validReq,
      );
      expect(validErr).toBeNull();

      const invalidReq = {
        body: {
          submissionDeadline: pastDate(2),
        },
      };
      const invalidErr = await runValidator(
        validators.enableLuckyDrawValidationRules,
        invalidReq,
      );
      expect(invalidErr).toBeTruthy();
      expect(invalidErr.statusCode).toBe(400);
    });

    it("submitEntryValidationRules should accept valid name and mobile and reject invalid", async () => {
      const validReq = {
        body: {
          name: "Joel",
          mobileNumber: "9876543210",
        },
      };
      const validErr = await runValidator(
        validators.submitEntryValidationRules,
        validReq,
      );
      expect(validErr).toBeNull();

      const invalidReq = {
        body: {
          name: "J", // too short
          mobileNumber: "123", // invalid mobile
        },
      };
      const invalidErr = await runValidator(
        validators.submitEntryValidationRules,
        invalidReq,
      );
      expect(invalidErr).toBeTruthy();
      expect(invalidErr.statusCode).toBe(400);
    });

    it("drawValidationRules should validate winnerCount and luckyDrawId", async () => {
      const validReq = {
        body: {
          winnerCount: 3,
        },
      };
      const validErr = await runValidator(
        validators.drawValidationRules,
        validReq,
      );
      expect(validErr).toBeNull();

      const invalidReq = {
        body: {
          luckyDrawId: "not-a-mongo-id",
        },
      };
      const invalidErr = await runValidator(
        validators.drawValidationRules,
        invalidReq,
      );
      expect(invalidErr).toBeTruthy();
      expect(invalidErr.statusCode).toBe(400);
    });
  });
});
