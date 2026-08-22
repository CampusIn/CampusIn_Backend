const now = new Date();
const endsAtDefault = new Date("2026-08-22T18:30:00+05:30");

const luckyWheelConfig = {
  eventId: process.env.LUCKY_WHEEL_EVENT_ID || "freshers-2026",
  startsAt: process.env.LUCKY_WHEEL_STARTS_AT
    ? new Date(process.env.LUCKY_WHEEL_STARTS_AT)
    : now,
  endsAt: process.env.LUCKY_WHEEL_ENDS_AT
    ? new Date(process.env.LUCKY_WHEEL_ENDS_AT)
    : endsAtDefault,
  couponExpiryDays: Number(process.env.LUCKY_WHEEL_COUPON_EXPIRY_DAYS || 7),
  prizes: [
    {
      id: "better-luck",
      label: "Better Luck Next Time",
      type: "none",
      probability: 50,
    },
    {
      id: "10-off",
      label: "10 OFF",
      type: "discount",
      discountType: "FIXED",
      discountValue: 10,
      probability: 30,
    },
    {
      id: "20-off",
      label: "20 OFF",
      type: "discount",
      discountType: "FIXED",
      discountValue: 20,
      probability: 20,
    },
    {
      id: "30-off",
      label: "30 OFF",
      type: "discount",
      discountType: "FIXED",
      discountValue: 30,
      probability: 0,
    },
    {
      id: "40-off",
      label: "40 OFF",
      type: "discount",
      discountType: "FIXED",
      discountValue: 40,
      probability: 0,
    },
    {
      id: "50-off",
      label: "50 OFF",
      type: "discount",
      discountType: "FIXED",
      discountValue: 50,
      probability: 0,
    },
  ],
};

export default luckyWheelConfig;
