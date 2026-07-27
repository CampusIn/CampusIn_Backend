import { Router } from "express";
import adminController from "../controllers/admin.controllers.js";
import { authMiddleware } from "../middlewares/auth.middlewares.js";
import roleMiddleware from "../middlewares/role.middleware.js";
import settingsValidatorsRules from "../validators/settings.validators.js";
import couponValidationRules from "../validators/coupon.validators.js";
import couponUpdateValidationRules from "../validators/couponUpdate.validators.js";
import announcementValidationRules from "../validators/anouncement.validators.js";
import bannerValidationRules from "../validators/banner.validators.js";
import bannerUpdateValidationRules from "../validators/bannerUpdate.validators.js";
import marketPlaceCategoryValidationRules from "../validators/marketPlaceCategory.validators.js";
import marketPlaceCategoryUpdateValidationRules from "../validators/marketPlaceCategoryUpdate.validators.js";
import marketPlaceProductsValidationRules from "../validators/marketPlaceProducts.validators.js";
import marketPlaceProductsUpdateValidationRules from "../validators/marketPlaceProductsUpdate.validators.js";
import repairPartnerValidationRules from "../validators/repairPartner.validators.js";
import updateRepairPartnerRules from "../validators/repairPartnerUpadation.validators.js";
import {
  estimateRepairRequestRules,
  assignRepairPartnerRules,
  completeRepairRequestRules,
} from "../validators/repairRequest.validators.js";
import upload from "../middlewares/multer.middlewares.js";

const adminRouter = Router();

adminRouter.get(
  "/dashboard",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.viewAdminDashboard,
);

adminRouter.get(
  "/dashboard/users",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.viewUsers,
);

adminRouter.get(
  "/dashboard/vendors",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.viewVendors,
);

adminRouter.get(
  "/dashboard/restaurants",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.viewRestaurants,
);

adminRouter.patch(
  "/users/:id/block",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.blockUser,
);

adminRouter.patch(
  "/users/:id/unblock",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.unBlockUser,
);

adminRouter.patch(
  "/restaurants/:id/suspend",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.suspendRestaurant,
);

adminRouter.patch(
  "/restaurants/:id/activate",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.activateRestaurant,
);

adminRouter.get(
  "/orders",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.getAllOrders,
);

adminRouter.get(
  "/orders/:id",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.getOrderById,
);

adminRouter.get(
  "/settings",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.configSettings,
);

adminRouter.patch(
  "/settings",
  authMiddleware,
  roleMiddleware("admin"),
  settingsValidatorsRules,
  adminController.editSettings,
);

adminRouter.get(
  "/view/settings",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.getPlatformSettingsAdmin,
);

adminRouter.post(
  "/coupons",
  authMiddleware,
  roleMiddleware("admin"),
  couponValidationRules,
  adminController.createCoupons,
);

adminRouter.get(
  "/coupons",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.getAllCoupons,
);

adminRouter.get(
  "/coupons/:couponId",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.getCouponById,
);

adminRouter.patch(
  "/coupons/:couponId",
  authMiddleware,
  roleMiddleware("admin"),
  couponUpdateValidationRules,
  adminController.updateCoupon,
);

adminRouter.patch(
  "/coupons/:couponId/status",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.updateCouponStatus,
);

adminRouter.post(
  "/announcements",
  authMiddleware,
  roleMiddleware("admin"),
  announcementValidationRules,
  adminController.createAnnouncements,
);

adminRouter.get(
  "/announcements",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.getAnnouncements,
);

adminRouter.get(
  "/announcements/:announcementId",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.getAnnouncementById,
);

adminRouter.patch(
  "/announcements/:announcementId",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.updateAnnouncement,
);

adminRouter.patch(
  "/announcements/:announcementId/status",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.updateAnnouncementStatus,
);

adminRouter.post(
  "/banners",
  authMiddleware,
  roleMiddleware("admin"),
  upload.single("image"),
  bannerValidationRules,
  adminController.createBanner,
);

adminRouter.get(
  "/banners",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.getAllBanners,
);

adminRouter.get(
  "/banners/:bannerId",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.getBannerById,
);

adminRouter.patch(
  "/banners/:bannerId",
  authMiddleware,
  roleMiddleware("admin"),
  upload.single("image"),
  bannerUpdateValidationRules,
  adminController.updateBanner,
);

adminRouter.patch(
  "/banners/:bannerId/status",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.updateBannerStatus,
);

adminRouter.get(
  "/dashboard/top-restaurant",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.topRestaurants,
);

adminRouter.get(
  "/orders/:orderId/invoice",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.generateInvoiceFood,
);

adminRouter.get(
  "/marketplace/orders/:orderId/invoice",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.generateInvoiceMarketPlace,
);

adminRouter.get(
  "/abandoned-carts",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.abandonCart,
);

adminRouter.post(
  "/abandoned-carts/:userId/remind",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.sendReminder,
);

adminRouter.get(
  "/marketplace/orders",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.getAllMarketPlaceOrdersAdmin,
);

adminRouter.get(
  "/marketplace/dashboard",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.getMarketPlaceDashboard,
);

adminRouter.get(
  "/marketplace/dashboard/top-products",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.getTopMarketPlaceProducts,
);

adminRouter.get(
  "/marketplace/dashboard/top-categories",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.getTopMarketPlaceCategories,
);

adminRouter.get(
  "/marketplace/dashboard/inventory",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.getMarketPlaceInventory,
);

adminRouter.get(
  "/marketplace/orders/:orderId",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.getMarketPlaceOrderByIdAdmin,
);

adminRouter.patch(
  "/marketplace/orders/:orderId/status",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.updateMarketPlaceOrderStatusAdmin,
);

adminRouter.patch(
  "/marketplace/orders/:orderId/assign-delivery",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.assignMarketPlaceDeliveryPartnerAdmin,
);

adminRouter.post(
  "/marketplace/categories",
  authMiddleware,
  roleMiddleware("admin"),
  upload.single("image"),
  marketPlaceCategoryValidationRules,
  adminController.createCategory,
);

adminRouter.get(
  "/marketplace/categories",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.getAllCategories,
);

adminRouter.get(
  "/marketplace/categories/:categoryId",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.getCategoryById,
);

adminRouter.patch(
  "/marketplace/categories/:categoryId",
  authMiddleware,
  roleMiddleware("admin"),
  upload.single("image"),
  marketPlaceCategoryUpdateValidationRules,
  adminController.updateCategory,
);

adminRouter.patch(
  "/marketPlace/categories/:categoryId/status",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.updateCategoryStatus,
);

adminRouter.post(
  "/marketplace/products",
  authMiddleware,
  roleMiddleware("admin"),
  upload.array("images", 5),
  marketPlaceProductsValidationRules,
  adminController.createProducts,
);

adminRouter.get(
  "/marketplace/products",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.getAllProducts,
);

adminRouter.get(
  "/marketplace/products/:productId",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.getProductById,
);

adminRouter.patch(
  "/marketplace/products/:productId",
  authMiddleware,
  roleMiddleware("admin"),
  upload.array("images", 5),
  marketPlaceProductsUpdateValidationRules,
  adminController.updateProduct,
);

adminRouter.patch(
  "/marketplace/products/:productId/status",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.updateProductStatus,
);

adminRouter.get(
  "/repair-requests",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.getAllRepairRequestsAdmin,
);

adminRouter.get(
  "/repair-requests/:requestId",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.getRepairRequestByIdAdmin,
);

adminRouter.patch(
  "/repair-requests/:requestId/estimate",
  authMiddleware,
  roleMiddleware("admin"),
  estimateRepairRequestRules,
  adminController.sendRepairRequestEstimateAdmin,
);

adminRouter.patch(
  "/repair-requests/:requestId/assign-partner",
  authMiddleware,
  roleMiddleware("admin"),
  assignRepairPartnerRules,
  adminController.assignRepairPartnerAdmin,
);

adminRouter.patch(
  "/repair-requests/:requestId/complete",
  authMiddleware,
  roleMiddleware("admin"),
  completeRepairRequestRules,
  adminController.completeRepairRequestAdmin,
);

adminRouter.post(
  "/repair-partners",
  authMiddleware,
  roleMiddleware("admin"),
  repairPartnerValidationRules,
  adminController.createRepairPartner,
);

adminRouter.get(
  "/repair-partners",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.getAllRepairPartner,
);

adminRouter.get(
  "/repair-partners/:partnerId",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.getOneRepairPartner,
);

adminRouter.patch(
  "/repair-partners/:partnerId",
  authMiddleware,
  roleMiddleware("admin"),
  updateRepairPartnerRules,
  adminController.updateRepairPartner,
);

adminRouter.patch(
  "/repair-partners/:partnerId/status",
  authMiddleware,
  roleMiddleware("admin"),
  adminController.updateRepairPartnerStatus,
);

export default adminRouter;
