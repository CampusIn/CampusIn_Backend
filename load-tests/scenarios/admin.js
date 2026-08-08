import { sleep } from "k6";
import { BASE_URL, buildOptions, sleepRange } from "../config.js";
import { authRequest } from "../helpers/auth.js";
import { checkResponse, pickRandom } from "../helpers/checks.js";

export const options = buildOptions("admin");

const listAdminOrders = () => {
  const response = authRequest({
    role: "admin",
    scenario: "admin",
    method: "GET",
    path: "/api/admin/orders",
    params: {
      tags: {
        operation: "admin_orders_list",
      },
    },
  });

  return checkResponse(response, {
    name: "admin orders list",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });
};

const listMarketplaceOrders = () => {
  const response = authRequest({
    role: "admin",
    scenario: "admin",
    method: "GET",
    path: "/api/admin/marketplace/orders",
    params: {
      tags: {
        operation: "admin_marketplace_orders_list",
      },
    },
  });

  return checkResponse(response, {
    name: "admin marketplace orders list",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });
};

export default function () {
  const dashboardResponse = authRequest({
    role: "admin",
    scenario: "admin",
    method: "GET",
    path: "/api/admin/dashboard",
    params: {
      tags: {
        operation: "admin_dashboard",
      },
    },
  });

  checkResponse(dashboardResponse, {
    name: "admin dashboard",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });

  const dashboardUsersResponse = authRequest({
    role: "admin",
    scenario: "admin",
    method: "GET",
    path: "/api/admin/dashboard/users",
    params: {
      tags: {
        operation: "admin_dashboard_users",
      },
    },
  });

  checkResponse(dashboardUsersResponse, {
    name: "admin dashboard users",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });

  const dashboardVendorsResponse = authRequest({
    role: "admin",
    scenario: "admin",
    method: "GET",
    path: "/api/admin/dashboard/vendors",
    params: {
      tags: {
        operation: "admin_dashboard_vendors",
      },
    },
  });

  checkResponse(dashboardVendorsResponse, {
    name: "admin dashboard vendors",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });

  const dashboardRestaurantsResponse = authRequest({
    role: "admin",
    scenario: "admin",
    method: "GET",
    path: "/api/admin/dashboard/restaurants",
    params: {
      tags: {
        operation: "admin_dashboard_restaurants",
      },
    },
  });

  checkResponse(dashboardRestaurantsResponse, {
    name: "admin dashboard restaurants",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });

  const settingsResponse = authRequest({
    role: "admin",
    scenario: "admin",
    method: "GET",
    path: "/api/admin/view/settings",
    params: {
      tags: {
        operation: "admin_platform_settings",
      },
    },
  });

  checkResponse(settingsResponse, {
    name: "admin platform settings",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });

  const couponsResponse = authRequest({
    role: "admin",
    scenario: "admin",
    method: "GET",
    path: "/api/admin/coupons",
    params: {
      tags: {
        operation: "admin_coupons",
      },
    },
  });

  checkResponse(couponsResponse, {
    name: "admin coupons",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });

  const announcementsResponse = authRequest({
    role: "admin",
    scenario: "admin",
    method: "GET",
    path: "/api/admin/announcements",
    params: {
      tags: {
        operation: "admin_announcements",
      },
    },
  });

  checkResponse(announcementsResponse, {
    name: "admin announcements",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });

  const bannersResponse = authRequest({
    role: "admin",
    scenario: "admin",
    method: "GET",
    path: "/api/admin/banners",
    params: {
      tags: {
        operation: "admin_banners",
      },
    },
  });

  checkResponse(bannersResponse, {
    name: "admin banners",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });

  const marketplaceDashboardResponse = authRequest({
    role: "admin",
    scenario: "admin",
    method: "GET",
    path: "/api/admin/marketplace/dashboard",
    params: {
      tags: {
        operation: "admin_marketplace_dashboard",
      },
    },
  });

  checkResponse(marketplaceDashboardResponse, {
    name: "admin marketplace dashboard",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });

  const ordersBody = listAdminOrders();
  const orderIds = (ordersBody?.data?.orders || []).map((order) => order?._id).filter(Boolean);
  const orderId = pickRandom(orderIds);

  if (orderId) {
    const orderDetailResponse = authRequest({
      role: "admin",
      scenario: "admin",
      method: "GET",
      path: `/api/admin/orders/${orderId}`,
      params: {
        tags: {
          operation: "admin_order_detail",
          endpoint: "/api/admin/orders/:id",
        },
      },
    });

    checkResponse(orderDetailResponse, {
      name: "admin order detail",
      expectedStatuses: [200],
      requireSuccess: true,
      requireJson: true,
      requireData: true,
    });
  }

  const marketplaceOrdersBody = listMarketplaceOrders();
  const marketplaceOrderIds = (marketplaceOrdersBody?.data?.orders || [])
    .map((order) => order?._id)
    .filter(Boolean);
  const marketplaceOrderId = pickRandom(marketplaceOrderIds);

  if (marketplaceOrderId) {
    const marketplaceOrderDetailResponse = authRequest({
      role: "admin",
      scenario: "admin",
      method: "GET",
      path: `/api/admin/marketplace/orders/${marketplaceOrderId}`,
      params: {
        tags: {
          operation: "admin_marketplace_order_detail",
          endpoint: "/api/admin/marketplace/orders/:orderId",
        },
      },
    });

    checkResponse(marketplaceOrderDetailResponse, {
      name: "admin marketplace order detail",
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
    stdout: `\nAdmin scenario completed against ${BASE_URL}\nhttp_reqs=${data.metrics.http_reqs?.values?.count || 0}\n`,
  };
};
