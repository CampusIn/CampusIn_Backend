import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";

const passThrough = (req, res, next) => next();
const makeHandler = (name) => jest.fn((req, res) => res.status(200).json({ name }));

process.env.MONGO_URI ||= "mongodb://127.0.0.1:27017/major-routes-test";
process.env.JWT_SECRET ||= "test-jwt-secret";
process.env.CLIENT_ID ||= "test-client-id";
process.env.ZEPTOMAIL_HOST ||= "smtp.zeptomail.com";
process.env.ZEPTOMAIL_PORT ||= "2525";
process.env.ZEPTOMAIL_USER ||= "test-zeptomail-user";
process.env.ZEPTOMAIL_PASS ||= "test-zeptomail-pass";
process.env.ZEPTOMAIL_FROM_EMAIL ||= "order@example.com";
process.env.ZEPTOMAIL_FROM_NAME ||= "Campus In";
process.env.CLOUDINARY_API_KEY ||= "test-cloudinary-api-key";
process.env.CLOUDINARY_API_SECRET ||= "test-cloudinary-api-secret";
process.env.CLOUDINARY_NAME ||= "test-cloudinary-name";
process.env.GOOGLE_CLIENT_ID ||= "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET ||= "test-google-client-secret";
process.env.GOOGLE_CALLBACK_URL ||= "http://localhost/api/auth/google/callback";
process.env.CLIENT_URL ||= "http://localhost:5173";
process.env.REDIS_HOST ||= "localhost";
process.env.REDIS_PORT ||= "6379";
process.env.REDIS_PASSWORD ||= "test-redis-password";

const roleMiddlewareMock = jest.fn(() => passThrough);

const restaurantControllerMock = {
  createRestaurant: makeHandler("createRestaurant"),
  updateRestaurant: makeHandler("updateRestaurant"),
  getMyRestaurants: makeHandler("getMyRestaurants"),
  getRestaurantById: makeHandler("getRestaurantById"),
  dltRestaurantById: makeHandler("dltRestaurantById"),
  updateRestaurantStatus: makeHandler("updateRestaurantStatus"),
  getAllRestaurantsByUser: makeHandler("getAllRestaurantsByUser"),
  getRestaurantByUser: makeHandler("getRestaurantByUser"),
};

const menuControllerMock = {
  createMenuItem: makeHandler("createMenuItem"),
  getRestaurantMenu: makeHandler("getRestaurantMenu"),
  getMenuSuggestions: makeHandler("getMenuSuggestions"),
  getMenuItemById: makeHandler("getMenuItemById"),
  updateMenuItem: makeHandler("updateMenuItem"),
  updateMenuStatus: makeHandler("updateMenuStatus"),
  deleteMenuItem: makeHandler("deleteMenuItem"),
};

const orderControllerMock = {
  createOrder: makeHandler("createOrder"),
  getAllOrders: makeHandler("getAllOrders"),
  getSingleOrder: makeHandler("getSingleOrder"),
  cancelOrder: makeHandler("cancelOrder"),
  getVendorOrder: makeHandler("getVendorOrder"),
  getPlatformSettingsVendor: makeHandler("getPlatformSettingsVendor"),
  getSingleVendorOrder: makeHandler("getSingleVendorOrder"),
  changeOrderStatus: makeHandler("changeOrderStatus"),
  getPlatformSettingsUser: makeHandler("getPlatformSettingsUser"),
  getAllCoupons: makeHandler("getAllCoupons"),
  applyCoupon: makeHandler("applyCoupon"),
};

const marketPlaceControllerMock = {
  getAllCategoriesByUser: makeHandler("getAllCategoriesByUser"),
  getCategoryPlatformSettings: makeHandler("getCategoryPlatformSettings"),
  getAllProductsByUser: makeHandler("getAllProductsByUser"),
  getMarketPlaceProductSuggestions: makeHandler("getMarketPlaceProductSuggestions"),
  getProductsByIdUser: makeHandler("getProductsByIdUser"),
};

const marketCartControllerMock = {
  addToMarketCart: makeHandler("addToMarketCart"),
  getItemsFromMarketCart: makeHandler("getItemsFromMarketCart"),
  updateMarketCartItemQuantity: makeHandler("updateMarketCartItemQuantity"),
  deleteMarketCartItem: makeHandler("deleteMarketCartItem"),
  deleteMarketCart: makeHandler("deleteMarketCart"),
};

const marketPlaceOrdersControllerMock = {
  createMarketPlaceOrder: makeHandler("createMarketPlaceOrder"),
  getAllMarketPlaceOrders: makeHandler("getAllMarketPlaceOrders"),
  getSingleMarketPlaceOrder: makeHandler("getSingleMarketPlaceOrder"),
  cancelMarketPlaceOrder: makeHandler("cancelMarketPlaceOrder"),
};

const reviewsControllerMock = {
  createReview: makeHandler("createReview"),
  getAllReview: makeHandler("getAllReview"),
  updateReview: makeHandler("updateReview"),
  deleteReview: makeHandler("deleteReview"),
};

const deliveryControllersMock = {
  createProfile: makeHandler("createProfile"),
  assignPartner: makeHandler("assignPartner"),
  viewAllOrders: makeHandler("viewAllOrders"),
  viewOneOrder: makeHandler("viewOneOrder"),
  pickUpOrder: makeHandler("pickUpOrder"),
  deliverOrder: makeHandler("deliverOrder"),
  viewAllMarketPlaceOrders: makeHandler("viewAllMarketPlaceOrders"),
  viewOrderById: makeHandler("viewOrderById"),
  updateOrderStatus: makeHandler("updateOrderStatus"),
  viewAllDeliveryPartners: makeHandler("viewAllDeliveryPartners"),
};

const homePageControllerMock = {
  getActiveBanners: makeHandler("getActiveBanners"),
  getActiveAnnouncements: makeHandler("getActiveAnnouncements"),
};

const vendorControllersMock = {
  getVendorOverview: makeHandler("getVendorOverview"),
  getTopItems: makeHandler("getTopItems"),
  orderStatusBreakdown: makeHandler("orderStatusBreakdown"),
  revenueStatsPerWeek: makeHandler("revenueStatsPerWeek"),
  averageOrderValue: makeHandler("averageOrderValue"),
  updateStock: makeHandler("updateStock"),
  getAllMenu: makeHandler("getAllMenu"),
  lowStockItems: makeHandler("lowStockItems"),
  bulkUpload: makeHandler("bulkUpload"),
  generateInvoiceFood: makeHandler("generateInvoiceFood"),
};

const repairControllerMock = {
  createRepairRequest: makeHandler("createRepairRequest"),
  getAllRepairRequests: makeHandler("getAllRepairRequests"),
  getRequestById: makeHandler("getRequestById"),
  customerDecision: makeHandler("customerDecision"),
};

jest.unstable_mockModule("../src/middlewares/auth.middlewares.js", () => ({
  authMiddleware: passThrough,
  setAuthRole: () => passThrough,
}));

jest.unstable_mockModule("../src/middlewares/role.middleware.js", () => ({
  default: roleMiddlewareMock,
}));

jest.unstable_mockModule("../src/middlewares/block.middlewares.js", () => ({
  blockMiddleware: passThrough,
}));

jest.unstable_mockModule("../src/middlewares/restaurantSuspension.middlewares.js", () => ({
  restaurantSuspensionMiddleware: passThrough,
}));

jest.unstable_mockModule("../src/middlewares/rateLimiter.middlewares.js", () => ({
  strictLimiter: passThrough,
  cartLimiter: passThrough,
  reviewsLimiter: passThrough,
  relaxedLimiter: passThrough,
  searchAwareRelaxedLimiter: passThrough,
  uploadLimiter: passThrough,
  getClientIp: jest.fn(() => "127.0.0.1"),
  getLoginRateLimitKey: jest.fn(() => "mock-key"),
  getBlockDurationFromAttempts: jest.fn(() => null),
  getLoginAttemptsRedisKey: jest.fn(() => "attempts-key"),
  getLoginBlockRedisKey: jest.fn(() => "block-key"),
}));

jest.unstable_mockModule("../src/middlewares/multer.middlewares.js", () => ({
  default: {
    single: () => passThrough,
    array: () => passThrough,
  },
}));

jest.unstable_mockModule("../src/controllers/restaurant.controllers.js", () => ({
  default: restaurantControllerMock,
}));
jest.unstable_mockModule("../src/controllers/menu.controllers.js", () => ({
  default: menuControllerMock,
}));
jest.unstable_mockModule("../src/controllers/order.controllers.js", () => ({
  default: orderControllerMock,
}));
jest.unstable_mockModule("../src/controllers/marketPlace.contollers.js", () => ({
  default: marketPlaceControllerMock,
}));
jest.unstable_mockModule("../src/controllers/marketCart.controllers.js", () => ({
  default: marketCartControllerMock,
}));
jest.unstable_mockModule("../src/controllers/marketPlaceOrders.contollers.js", () => ({
  default: marketPlaceOrdersControllerMock,
}));
jest.unstable_mockModule("../src/controllers/reviews.controllers.js", () => ({
  default: reviewsControllerMock,
}));
jest.unstable_mockModule("../src/controllers/deliveryPartner.controllers.js", () => ({
  default: deliveryControllersMock,
}));
jest.unstable_mockModule("../src/controllers/homePageCMS.controllers.js", () => ({
  default: homePageControllerMock,
}));
jest.unstable_mockModule("../src/controllers/vendor.controllers.js", () => ({
  default: vendorControllersMock,
}));
jest.unstable_mockModule("../src/controllers/repairRequest.controllers.js", () => ({
  default: repairControllerMock,
}));
jest.unstable_mockModule("../src/controllers/auth.controllers.js", () => ({
  default: {},
}));

jest.unstable_mockModule("../src/validators/restaurant.validators.js", () => ({
  restaurantValidationRules: passThrough,
  restaurantStatusValidationRule: passThrough,
}));
jest.unstable_mockModule("../src/validators/menu.validators.js", () => ({
  menuValidationRules: passThrough,
}));
jest.unstable_mockModule("../src/validators/menuUpdate.validators.js", () => ({
  menuUpdateValidationRules: passThrough,
}));
jest.unstable_mockModule("../src/validators/menuStatus.validators.js", () => ({
  menuStatusValidationRule: passThrough,
}));
jest.unstable_mockModule("../src/validators/review.validators.js", () => ({
  default: passThrough,
}));
jest.unstable_mockModule("../src/validators/marketCart.validators.js", () => ({
  default: passThrough,
}));
jest.unstable_mockModule("../src/validators/deliveryPartner.validators.js", () => ({
  default: {
    deliveryPartnerValidationRules: passThrough,
  },
}));
jest.unstable_mockModule("../src/validators/repairRequest.validators.js", () => ({
  createRepairRequestRules: passThrough,
  updateRepairRequestRules: passThrough,
}));

let app;

beforeAll(async () => {
  const [
    { default: restaurantRoute },
    { default: menuRouter },
    { default: cartRouter },
    { default: orderRouter },
    { default: reviewRoute },
    { default: deliveryRouter },
    { default: homePageRouter },
    { default: marketRouter },
    { default: marketCartRouter },
    { default: marketPlaceOrdersRouter },
    { default: vendorRouter },
    { default: repairRouter },
  ] = await Promise.all([
    import("../src/routes/restaurant.routes.js"),
    import("../src/routes/menu.routes.js"),
    import("../src/routes/cart.routes.js"),
    import("../src/routes/order.routes.js"),
    import("../src/routes/review.routes.js"),
    import("../src/routes/deliveryPartner.routes.js"),
    import("../src/routes/homepageCMS.routes.js"),
    import("../src/routes/marketPlace.routes.js"),
    import("../src/routes/marketCart.routes.js"),
    import("../src/routes/marketPlace.Orders.routes.js"),
    import("../src/routes/vendor.routes.js"),
    import("../src/routes/repairRequest.routes.js"),
  ]);

  app = express();
  app.use(express.json());
  app.use("/api", restaurantRoute);
  app.use("/api/restaurants", menuRouter);
  app.use("/api/user", cartRouter);
  app.use("/api/user", orderRouter);
  app.use("/api/user", reviewRoute);
  app.use("/api/delivery", deliveryRouter);
  app.use("/api/vendor", vendorRouter);
  app.use("/api/user/homepage", homePageRouter);
  app.use("/api/marketplace", marketRouter);
  app.use("/api/marketplace", marketCartRouter);
  app.use("/api/marketplace", marketPlaceOrdersRouter);
  app.use("/api/repair-requests", repairRouter);
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("major route groups", () => {
  it("routes restaurant endpoints to controller handlers", async () => {
    await request(app).post("/api/restaurants").send({});
    await request(app).get("/api/restaurants");
    await request(app).get("/api/restaurant/abc");

    expect(restaurantControllerMock.createRestaurant).toHaveBeenCalledTimes(1);
    expect(restaurantControllerMock.getAllRestaurantsByUser).toHaveBeenCalledTimes(1);
    expect(restaurantControllerMock.getRestaurantByUser).toHaveBeenCalledTimes(1);
  });

  it("routes menu endpoints to controller handlers", async () => {
    await request(app).post("/api/restaurants/abc/menu").send({});
    await request(app).get("/api/restaurants/abc/menu");
    await request(app).get("/api/restaurants/menu/suggestions").query({ q: "do" });

    expect(menuControllerMock.createMenuItem).toHaveBeenCalledTimes(1);
    expect(menuControllerMock.getRestaurantMenu).toHaveBeenCalledTimes(1);
    expect(menuControllerMock.getMenuSuggestions).toHaveBeenCalledTimes(1);
  });

  it("routes food order endpoints to controller handlers", async () => {
    await request(app).post("/api/user/order").send({});
    await request(app).get("/api/user/orders/my");
    await request(app).post("/api/user/coupons/apply").send({ couponId: "x" });

    expect(orderControllerMock.createOrder).toHaveBeenCalledTimes(1);
    expect(orderControllerMock.getAllOrders).toHaveBeenCalledTimes(1);
    expect(orderControllerMock.applyCoupon).toHaveBeenCalledTimes(1);
  });

  it("routes marketplace catalog endpoints to controller handlers", async () => {
    await request(app).get("/api/marketplace/categories");
    await request(app).get("/api/marketplace/products");
    await request(app).get("/api/marketplace/products/suggestions").query({ q: "lap" });

    expect(marketPlaceControllerMock.getAllCategoriesByUser).toHaveBeenCalledTimes(1);
    expect(marketPlaceControllerMock.getAllProductsByUser).toHaveBeenCalledTimes(1);
    expect(
      marketPlaceControllerMock.getMarketPlaceProductSuggestions,
    ).toHaveBeenCalledTimes(1);
  });

  it("routes marketplace cart and order endpoints to controller handlers", async () => {
    await request(app).post("/api/marketplace/cart").send({});
    await request(app).post("/api/marketplace/orders").send({});
    await request(app).patch("/api/marketplace/orders/abc/cancel").send({});

    expect(marketCartControllerMock.addToMarketCart).toHaveBeenCalledTimes(1);
    expect(marketPlaceOrdersControllerMock.createMarketPlaceOrder).toHaveBeenCalledTimes(1);
    expect(marketPlaceOrdersControllerMock.cancelMarketPlaceOrder).toHaveBeenCalledTimes(1);
  });

  it("routes review endpoints to controller handlers", async () => {
    await request(app).post("/api/user/reviews/abc").send({ rating: 5, comment: "great" });
    await request(app).get("/api/user/restaurants/abc/reviews");
    await request(app).patch("/api/user/reviews/abc").send({ rating: 4 });

    expect(reviewsControllerMock.createReview).toHaveBeenCalledTimes(1);
    expect(reviewsControllerMock.getAllReview).toHaveBeenCalledTimes(1);
    expect(reviewsControllerMock.updateReview).toHaveBeenCalledTimes(1);
  });

  it("routes delivery and vendor endpoints to controller handlers", async () => {
    await request(app).post("/api/delivery/profile").send({});
    await request(app).patch("/api/delivery/orders/abc/deliver").send({});
    await request(app).get("/api/vendor/dashboard/overview");

    expect(deliveryControllersMock.createProfile).toHaveBeenCalledTimes(1);
    expect(deliveryControllersMock.deliverOrder).toHaveBeenCalledTimes(1);
    expect(vendorControllersMock.getVendorOverview).toHaveBeenCalledTimes(1);
  });

  it("routes homepage and repair-request endpoints to controller handlers", async () => {
    await request(app).get("/api/user/homepage/banners");
    await request(app).post("/api/repair-requests").send({});
    await request(app).get("/api/repair-requests");

    expect(homePageControllerMock.getActiveBanners).toHaveBeenCalledTimes(1);
    expect(repairControllerMock.createRepairRequest).toHaveBeenCalledTimes(1);
    expect(repairControllerMock.getAllRepairRequests).toHaveBeenCalledTimes(1);
  });

});
