import { sleep } from "k6";
import {
  buildOptions,
  CART_WRITE_EVERY_N_ITER,
  ENABLE_CART_WRITES,
  sleepRange,
} from "../config.js";
import { authRequest } from "../helpers/auth.js";
import { checkResponse, pickRandom } from "../helpers/checks.js";

export const options = buildOptions("user");

const getRestaurantIds = (body) => {
  return (body?.data?.restaurant || []).map((restaurant) => restaurant?._id).filter(Boolean);
};

const getMenuItems = (body) => {
  return Array.isArray(body?.data) ? body.data : [];
};

const getAvailableMenuItem = (menuItems) => {
  const eligibleItems = menuItems.filter((item) => {
    const available = item?.isAvailable !== false;
    const inStock = item?.stockQty === undefined || Number(item.stockQty) > 0;
    return available && inStock && item?._id;
  });

  return pickRandom(eligibleItems) || null;
};

const listRestaurants = () => {
  const path = "/api/restaurants?page=1&limit=20";
  const response = authRequest({
    role: "user",
    scenario: "user",
    method: "GET",
    path,
    params: { tags: { operation: "restaurants_list" } },
  });

  return checkResponse(response, {
    name: "user restaurants list",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });
};

const listMarketplaceProducts = () => {
  const path = "/api/marketplace/products?page=1&limit=20";
  const response = authRequest({
    role: "user",
    scenario: "user",
    method: "GET",
    path,
    params: { tags: { operation: "marketplace_products" } },
  });

  return checkResponse(response, {
    name: "user marketplace products",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });
};

const getMenuForRestaurant = (restaurantId) => {
  if (!restaurantId) {
    return null;
  }

  const response = authRequest({
    role: "user",
    scenario: "user",
    method: "GET",
    path: `/api/restaurants/${restaurantId}/menu`,
    params: { tags: { operation: "restaurant_menu" } },
  });

  return checkResponse(response, {
    name: "user restaurant menu",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });
};

const performSafeCartWrite = ({ preferredRestaurantId, cartBody }) => {
  const targetRestaurantId = preferredRestaurantId;
  if (!targetRestaurantId) {
    return;
  }

  const existingItemIds = (cartBody?.data?.items || [])
    .map((item) => item?.menuItem?._id)
    .filter(Boolean);

  const existingItemId = pickRandom(existingItemIds);

  if (existingItemId) {
    const updateExistingItemResponse = authRequest({
      role: "user",
      scenario: "user",
      method: "PATCH",
      path: `/api/user/cart/items/${existingItemId}`,
      body: {
        quantity: 1,
      },
      params: { tags: { operation: "cart_update_existing_item" } },
    });

    checkResponse(updateExistingItemResponse, {
      name: "user cart update existing item",
      expectedStatuses: [200],
      requireSuccess: true,
      requireJson: true,
      requireData: true,
    });

    return;
  }

  const menuBody = getMenuForRestaurant(targetRestaurantId);
  const availableMenuItem = getAvailableMenuItem(getMenuItems(menuBody));
  if (!availableMenuItem?._id) {
    return;
  }

  const addToCartResponse = authRequest({
    role: "user",
    scenario: "user",
    method: "POST",
    path: "/api/user/cart/items",
    body: {
      menuItemId: availableMenuItem._id,
      quantity: 1,
    },
    params: { tags: { operation: "cart_add_item" } },
  });

  checkResponse(addToCartResponse, {
    name: "user cart add item",
    expectedStatuses: [201],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });

  const updateCartResponse = authRequest({
    role: "user",
    scenario: "user",
    method: "PATCH",
    path: `/api/user/cart/items/${availableMenuItem._id}`,
    body: {
      quantity: 1,
    },
    params: { tags: { operation: "cart_update_item" } },
  });

  checkResponse(updateCartResponse, {
    name: "user cart update item",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });
};

export default function () {
  const meResponse = authRequest({
    role: "user",
    scenario: "user",
    method: "GET",
    path: "/api/auth/me",
    params: { tags: { operation: "profile_me" } },
  });

  checkResponse(meResponse, {
    name: "user me",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });

  const bannersPath = "/api/user/homepage/banners";
  const bannersResponse = authRequest({
    role: "user",
    scenario: "user",
    method: "GET",
    path: bannersPath,
    params: { tags: { operation: "homepage_banners" } },
  });

  checkResponse(bannersResponse, {
    name: "user homepage banners",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });

  const announcementsPath = "/api/user/homepage/announcements";
  const announcementsResponse = authRequest({
    role: "user",
    scenario: "user",
    method: "GET",
    path: announcementsPath,
    params: { tags: { operation: "homepage_announcements" } },
  });

  checkResponse(announcementsResponse, {
    name: "user homepage announcements",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });

  const restaurantsBody = listRestaurants();
  const dynamicRestaurantIds = getRestaurantIds(restaurantsBody);
  const restaurantId = pickRandom(dynamicRestaurantIds);

  let activeRestaurantId = restaurantId || null;

  if (restaurantId) {
    const restaurantDetailResponse = authRequest({
      role: "user",
      scenario: "user",
      method: "GET",
      path: `/api/restaurant/${restaurantId}`,
      params: { tags: { operation: "restaurant_detail" } },
    });

    checkResponse(restaurantDetailResponse, {
      name: "user restaurant detail",
      expectedStatuses: [200],
      requireSuccess: true,
      requireJson: true,
      requireData: true,
    });

    const reviewsResponse = authRequest({
      role: "user",
      scenario: "user",
      method: "GET",
      path: `/api/user/restaurants/${restaurantId}/reviews?page=1&limit=5`,
      params: { tags: { operation: "restaurant_reviews" } },
    });

    checkResponse(reviewsResponse, {
      name: "user restaurant reviews",
      expectedStatuses: [200],
      requireSuccess: true,
      requireJson: true,
      requireData: true,
    });
  }

  const cartResponse = authRequest({
    role: "user",
    scenario: "user",
    method: "GET",
    path: "/api/user/cart",
    params: { tags: { operation: "cart_get" } },
  });

  const cartBody = checkResponse(cartResponse, {
    name: "user cart get",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });

  const cartRestaurantId = cartBody?.data?.restaurant?._id || null;
  if (cartRestaurantId) {
    activeRestaurantId = cartRestaurantId;
  }

  const shouldWriteToCart =
    ENABLE_CART_WRITES &&
    CART_WRITE_EVERY_N_ITER > 0 &&
    __ITER % CART_WRITE_EVERY_N_ITER === 0;

  if (shouldWriteToCart && activeRestaurantId) {
    performSafeCartWrite({
      preferredRestaurantId: activeRestaurantId,
      cartBody,
    });

    const cartAfterWriteResponse = authRequest({
      role: "user",
      scenario: "user",
      method: "GET",
      path: "/api/user/cart",
      params: { tags: { operation: "cart_get_after_write" } },
    });

    checkResponse(cartAfterWriteResponse, {
      name: "user cart get after write",
      expectedStatuses: [200],
      requireSuccess: true,
      requireJson: true,
      requireData: true,
    });
  }

  const marketplaceCategoriesPath = "/api/marketplace/categories?page=1&limit=20";
  const marketplaceCategoriesResponse = authRequest({
    role: "user",
    scenario: "user",
    method: "GET",
    path: marketplaceCategoriesPath,
    params: { tags: { operation: "marketplace_categories" } },
  });

  checkResponse(marketplaceCategoriesResponse, {
    name: "user marketplace categories",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });

  const marketplaceProductsBody = listMarketplaceProducts();
  const dynamicProductIds = (marketplaceProductsBody?.data?.products || [])
    .map((product) => product?._id)
    .filter(Boolean);
  const productId = pickRandom(dynamicProductIds);

  if (productId) {
    const productDetailResponse = authRequest({
      role: "user",
      scenario: "user",
      method: "GET",
      path: `/api/marketplace/products/${productId}`,
      params: { tags: { operation: "marketplace_product_detail" } },
    });

    checkResponse(productDetailResponse, {
      name: "user marketplace product detail",
      expectedStatuses: [200],
      requireSuccess: true,
      requireJson: true,
      requireData: true,
    });
  }

  const marketplaceSuggestionsResponse = authRequest({
    role: "user",
    scenario: "user",
    method: "GET",
    path: "/api/marketplace/products/suggestions?q=a",
    params: { tags: { operation: "marketplace_product_suggestions" } },
  });

  checkResponse(marketplaceSuggestionsResponse, {
    name: "user marketplace suggestions",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });

  const marketplaceCartResponse = authRequest({
    role: "user",
    scenario: "user",
    method: "GET",
    path: "/api/marketplace/cart",
    params: { tags: { operation: "marketplace_cart_get" } },
  });

  checkResponse(marketplaceCartResponse, {
    name: "user marketplace cart get",
    expectedStatuses: [200],
    requireSuccess: true,
    requireJson: true,
    requireData: true,
  });

  sleep(sleepRange(1, 3));
}
