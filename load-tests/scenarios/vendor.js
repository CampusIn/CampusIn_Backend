import { sleep } from "k6";
import { BASE_URL, buildOptions, sleepRange } from "../config.js";
import { authRequest } from "../helpers/auth.js";
import { checkResponse, pickRandom } from "../helpers/checks.js";

export const options = buildOptions("vendor");

const getVendorOrders = () => {
  const response = authRequest({
    role: "vendor",
    scenario: "vendor",
    method: "GET",
    path: "/api/user/order/restaurant?page=1&limit=10",
    params: {
      tags: {
        operation: "vendor_orders_list",
        endpoint: "/api/user/order/restaurant",
      },
    },
  });

  return checkResponse(response, {
    name: "vendor orders list",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });
};

export default function () {
  const dashboardOverview = authRequest({
    role: "vendor",
    scenario: "vendor",
    method: "GET",
    path: "/api/vendor/dashboard/overview",
    params: { tags: { operation: "dashboard_overview" } },
  });

  checkResponse(dashboardOverview, {
    name: "vendor dashboard overview",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });

  const dashboardTopItems = authRequest({
    role: "vendor",
    scenario: "vendor",
    method: "GET",
    path: "/api/vendor/dashboard/top-items",
    params: { tags: { operation: "dashboard_top_items" } },
  });

  checkResponse(dashboardTopItems, {
    name: "vendor dashboard top items",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });

  const dashboardOrderBreakdown = authRequest({
    role: "vendor",
    scenario: "vendor",
    method: "GET",
    path: "/api/vendor/dashboard/order-status-breakdown",
    params: { tags: { operation: "dashboard_order_status" } },
  });

  checkResponse(dashboardOrderBreakdown, {
    name: "vendor dashboard order status",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });

  const dashboardRevenue = authRequest({
    role: "vendor",
    scenario: "vendor",
    method: "GET",
    path: "/api/vendor/dashboard/daily-revenue",
    params: { tags: { operation: "dashboard_daily_revenue" } },
  });

  checkResponse(dashboardRevenue, {
    name: "vendor dashboard daily revenue",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });

  const dashboardAverageOrder = authRequest({
    role: "vendor",
    scenario: "vendor",
    method: "GET",
    path: "/api/vendor/dashboard/average-order-value",
    params: { tags: { operation: "dashboard_average_order" } },
  });

  checkResponse(dashboardAverageOrder, {
    name: "vendor dashboard average order",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });

  const inventoryResponse = authRequest({
    role: "vendor",
    scenario: "vendor",
    method: "GET",
    path: "/api/vendor/inventory",
    params: { tags: { operation: "inventory_list" } },
  });

  checkResponse(inventoryResponse, {
    name: "vendor inventory",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });

  const lowStockResponse = authRequest({
    role: "vendor",
    scenario: "vendor",
    method: "GET",
    path: "/api/vendor/inventory/low-stock",
    params: { tags: { operation: "inventory_low_stock" } },
  });

  checkResponse(lowStockResponse, {
    name: "vendor inventory low stock",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });

  const platformSettingsResponse = authRequest({
    role: "vendor",
    scenario: "vendor",
    method: "GET",
    path: "/api/user/view/settings",
    params: { tags: { operation: "vendor_platform_settings" } },
  });

  checkResponse(platformSettingsResponse, {
    name: "vendor platform settings",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });

  const ordersBody = getVendorOrders();
  const orderIds = (ordersBody?.data?.orders || []).map((order) => order?._id).filter(Boolean);
  const orderId = pickRandom(orderIds);

  if (orderId) {
    const orderDetailResponse = authRequest({
      role: "vendor",
      scenario: "vendor",
      method: "GET",
      path: `/api/user/order/restaurant/${orderId}`,
      params: {
        tags: {
          operation: "vendor_order_detail",
          endpoint: "/api/user/order/restaurant/:orderId",
        },
      },
    });

    checkResponse(orderDetailResponse, {
      name: "vendor order detail",
      expectedStatuses: [200],
      requireSuccess: true,
      requireJson: true,
      requireData: true,
    });
  }

  sleep(sleepRange(1, 3));
}

export const handleSummary = (data) => {
  return {
    stdout: `\nVendor scenario completed against ${BASE_URL}\nhttp_reqs=${data.metrics.http_reqs?.values?.count || 0}\n`,
  };
};
