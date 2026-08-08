import http from "k6/http";
import { sleep } from "k6";
import {
  BASE_URL,
  buildOptions,
  sleepRange,
  taggedParams,
  withClientIpHeader,
} from "../config.js";
import { checkResponse, pickRandom } from "../helpers/checks.js";

export const options = buildOptions("public");

const fetchRestaurants = () => {
  const response = http.get(
    `${BASE_URL}/api/restaurants?page=1&limit=20`,
    taggedParams("public", "restaurants_list", "/api/restaurants", {
      headers: withClientIpHeader(),
    }),
  );

  const body = checkResponse(response, {
    name: "public restaurants list",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });

  return body?.data?.restaurant || [];
};

const fetchMenuItems = (restaurantId) => {
  if (!restaurantId) {
    return [];
  }

  const response = http.get(
    `${BASE_URL}/api/restaurants/${restaurantId}/menu`,
    taggedParams("public", "restaurant_menu", "/api/restaurants/:restaurantId/menu", {
      headers: withClientIpHeader(),
    }),
  );

  const body = checkResponse(response, {
    name: "public restaurant menu",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });

  return Array.isArray(body?.data) ? body.data : [];
};

export const setup = () => {
  const restaurants = fetchRestaurants();
  const restaurantIds = restaurants
    .map((restaurant) => restaurant?._id)
    .filter(Boolean);

  const firstRestaurantId = restaurantIds[0] || null;
  const menuItems = fetchMenuItems(firstRestaurantId);
  const menuItemIds = menuItems.map((item) => item?._id).filter(Boolean);

  return {
    restaurantIds,
    menuItemIds,
  };
};

export default function (data) {
  const healthResponse = http.get(
    `${BASE_URL}/health`,
    taggedParams("public", "health_check", "/health", {
      headers: withClientIpHeader(),
    }),
  );

  checkResponse(healthResponse, {
    name: "public health",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
  });

  const restaurants = fetchRestaurants();
  const dynamicRestaurantIds = restaurants.map((restaurant) => restaurant?._id).filter(Boolean);
  const restaurantId = pickRandom(dynamicRestaurantIds.length ? dynamicRestaurantIds : data.restaurantIds);

  if (restaurantId) {
    const restaurantDetailResponse = http.get(
      `${BASE_URL}/api/restaurant/${restaurantId}`,
      taggedParams("public", "restaurant_detail", "/api/restaurant/:id", {
        headers: withClientIpHeader(),
      }),
    );

    checkResponse(restaurantDetailResponse, {
      name: "public restaurant detail",
      expectedStatuses: [200],
      requireSuccess: true,
      requireJson: true,
      requireData: true,
    });

    const menuItems = fetchMenuItems(restaurantId);
    const currentMenuIds = menuItems.map((item) => item?._id).filter(Boolean);
    const menuItemId = pickRandom(currentMenuIds.length ? currentMenuIds : data.menuItemIds);

    if (menuItemId) {
      const menuItemResponse = http.get(
        `${BASE_URL}/api/restaurants/menu/${menuItemId}`,
        taggedParams("public", "menu_item_detail", "/api/restaurants/menu/:id", {
          headers: withClientIpHeader(),
        }),
      );

      checkResponse(menuItemResponse, {
        name: "public menu item detail",
        expectedStatuses: [200],
        requireSuccess: true,
        requireJson: true,
        requireData: true,
      });
    }

    const reviewsResponse = http.get(
      `${BASE_URL}/api/user/restaurants/${restaurantId}/reviews?page=1&limit=5`,
      taggedParams("public", "restaurant_reviews", "/api/user/restaurants/:restaurantId/reviews", {
        headers: withClientIpHeader(),
      }),
    );

    checkResponse(reviewsResponse, {
      name: "public restaurant reviews",
      expectedStatuses: [200],
      requireSuccess: true,
      requireJson: true,
      requireData: true,
    });
  }

  sleep(sleepRange(1, 3));
}
