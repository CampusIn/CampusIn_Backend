import { sleep } from "k6";
import { BASE_URL, buildOptions, sleepRange } from "../config.js";
import { authRequest } from "../helpers/auth.js";
import { checkResponse, pickRandom } from "../helpers/checks.js";

export const options = buildOptions("delivery");

const getFoodDeliveryOrders = () => {
  const response = authRequest({
    role: "delivery",
    scenario: "delivery",
    method: "GET",
    path: "/api/delivery/orders",
    params: {
      tags: {
        operation: "delivery_orders_list",
      },
    },
  });

  return checkResponse(response, {
    name: "delivery orders list",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });
};

const getMarketplaceDeliveryOrders = () => {
  const response = authRequest({
    role: "delivery",
    scenario: "delivery",
    method: "GET",
    path: "/api/delivery/marketplace/orders",
    params: {
      tags: {
        operation: "delivery_marketplace_orders_list",
      },
    },
  });

  return checkResponse(response, {
    name: "delivery marketplace orders list",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });
};

export default function () {
  const foodOrdersBody = getFoodDeliveryOrders();
  const foodOrderIds = (foodOrdersBody?.data || []).map((order) => order?._id).filter(Boolean);
  const foodOrderId = pickRandom(foodOrderIds);

  if (foodOrderId) {
    const foodOrderDetailResponse = authRequest({
      role: "delivery",
      scenario: "delivery",
      method: "GET",
      path: `/api/delivery/orders/${foodOrderId}`,
      params: {
        tags: {
          operation: "delivery_order_detail",
          endpoint: "/api/delivery/orders/:orderId",
        },
      },
    });

    checkResponse(foodOrderDetailResponse, {
      name: "delivery order detail",
      expectedStatuses: [200],
      requireSuccess: true,
      requireJson: true,
      requireData: true,
    });
  }

  const marketplaceOrdersBody = getMarketplaceDeliveryOrders();
  const marketplaceOrderIds = (marketplaceOrdersBody?.data || [])
    .map((order) => order?._id)
    .filter(Boolean);
  const marketplaceOrderId = pickRandom(marketplaceOrderIds);

  if (marketplaceOrderId) {
    const marketplaceOrderDetailResponse = authRequest({
      role: "delivery",
      scenario: "delivery",
      method: "GET",
      path: `/api/delivery/marketplace/orders/${marketplaceOrderId}`,
      params: {
        tags: {
          operation: "delivery_marketplace_order_detail",
          endpoint: "/api/delivery/marketplace/orders/:orderId",
        },
      },
    });

    checkResponse(marketplaceOrderDetailResponse, {
      name: "delivery marketplace order detail",
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
    stdout: `\nDelivery scenario completed against ${BASE_URL}\nhttp_reqs=${data.metrics.http_reqs?.values?.count || 0}\n`,
  };
};
