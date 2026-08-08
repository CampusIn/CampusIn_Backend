import { sleep } from "k6";
import { Counter } from "k6/metrics";
import exec from "k6/execution";
import { buildOptions, sleepRange, TEST_TYPE } from "../config.js";
import {
  authRequest,
  getCredentialPoolInfo,
  getCredentialSelection,
} from "../helpers/auth.js";
import { checkResponse, pickRandom } from "../helpers/checks.js";

export const options = buildOptions("mixed-user");

const cartAddSuccess = new Counter("cart_add_success");
const cartUpdateSuccess = new Counter("cart_update_success");
const cartDeleteSuccess = new Counter("cart_delete_success");
const cartOperationErrors = new Counter("cart_operation_errors");

const marketplaceCartAddSuccess = new Counter("marketplace_cart_add_success");
const marketplaceCartUpdateSuccess = new Counter("marketplace_cart_update_success");
const marketplaceCartDeleteSuccess = new Counter("marketplace_cart_delete_success");
const marketplaceCartOperationErrors = new Counter("marketplace_cart_operation_errors");

const OPERATION_WEIGHTS = {
  read_browse: 60,
  cart_read: 20,
  cart_write: 15,
  cleanup: 5,
};

const toBool = (value, fallback) => {
  if (value === undefined) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
};

const MIXED_WRITE_ENABLED =
  __ENV.MIXED_WRITE_ENABLED !== undefined
    ? toBool(__ENV.MIXED_WRITE_ENABLED, true)
    : TEST_TYPE !== "smoke";

const ALLOW_SHARED_TEST_USERS =
  __ENV.ALLOW_SHARED_TEST_USERS === undefined
    ? true
    : toBool(__ENV.ALLOW_SHARED_TEST_USERS, true);

const csvEnv = (pluralKey, singularKey) => {
  const plural = String(__ENV[pluralKey] || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (plural.length > 0) {
    return plural;
  }

  const singular = String(__ENV[singularKey] || "").trim();
  return singular ? [singular] : [];
};

const configuredRestaurantIds = csvEnv("TEST_RESTAURANT_IDS", "TEST_RESTAURANT_ID");
const configuredMenuItemIds = csvEnv("TEST_MENU_ITEM_IDS", "TEST_MENU_ITEM_ID");
const configuredMarketplaceProductIds = csvEnv(
  "TEST_MARKETPLACE_PRODUCT_IDS",
  "TEST_MARKETPLACE_PRODUCT_ID",
);

const requiredUniqueUsers = Math.max(
  1,
  ...(Array.isArray(options.stages) ? options.stages.map((stage) => Number(stage.target) || 0) : [1]),
);

const vuState = {
  lastFoodItemId: null,
  lastMarketplaceProductId: null,
  discoveredRestaurantIds: [],
  discoveredMenuItemIds: [],
  discoveredMarketplaceProductIds: [],
  menuItemIdsByRestaurant: {},
  productIdsByCategory: {},
  poolValidated: false,
};

const pickRoundRobin = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  const vuOffset = typeof __VU === "number" ? __VU - 1 : 0;
  const iterOffset = typeof __ITER === "number" ? __ITER : 0;
  const index = (vuOffset + iterOffset) % items.length;
  return items[index];
};

const getIdValue = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object") {
    if (typeof value._id === "string") {
      return value._id;
    }
    if (typeof value.id === "string") {
      return value.id;
    }
  }

  return null;
};

const getVuTags = () => {
  const selection = getCredentialSelection("user");
  return {
    vu: String(selection.vu),
    user_pool_index: String(selection.poolIndex + 1),
  };
};

const weightedOperation = () => {
  const roll = Math.random() * 100;
  if (roll < OPERATION_WEIGHTS.read_browse) {
    return "read_browse";
  }

  if (roll < OPERATION_WEIGHTS.read_browse + OPERATION_WEIGHTS.cart_read) {
    return "cart_read";
  }

  if (
    roll <
    OPERATION_WEIGHTS.read_browse +
      OPERATION_WEIGHTS.cart_read +
      OPERATION_WEIGHTS.cart_write
  ) {
    return "cart_write";
  }

  return "cleanup";
};

const checkedRequest = ({
  role = "user",
  method,
  path,
  operation,
  endpoint,
  body,
  expectedStatuses = [200],
  requireData = true,
  requireSuccess = true,
}) => {
  const vuTags = getVuTags();
  const route = endpoint || path.split("?")[0];
  const response = authRequest({
    role,
    scenario: "mixed-user",
    method,
    path,
    body,
    params: {
      tags: {
        operation,
        endpoint: route,
        ...vuTags,
      },
    },
  });

  return {
    response,
    body: checkResponse(response, {
      name: `mixed-user ${operation}`,
      expectedStatuses,
      requireSuccess,
      requireJson: true,
      requireData,
      metricTags: {
        scenario: "mixed-user",
        operation,
        endpoint: route,
        test_type: TEST_TYPE,
        ...vuTags,
      },
      requestInfo: {
        scenario: "mixed-user",
        operation,
        endpoint: route,
        method,
        path,
        requestPayload: body ? JSON.stringify(body) : "",
      },
    }),
  };
};

const collectRestaurantIds = (payload) => {
  return (payload?.data?.restaurant || []).map((item) => item?._id).filter(Boolean);
};

const collectMenuItems = (payload, restaurantId = null) => {
  const items = (payload?.data || []).filter((item) => {
    return item?._id && item?.isAvailable !== false && Number(item?.stockQty || 0) > 0;
  });

  const ids = items.map((item) => item._id);
  if (restaurantId && ids.length > 0) {
    vuState.menuItemIdsByRestaurant[restaurantId] = ids;
  }

  return ids;
};

const collectMarketplaceProducts = (payload) => {
  const products = (payload?.data?.products || []).filter((item) => item?._id);
  const ids = [];

  for (const product of products) {
    ids.push(product._id);
    const categoryId = getIdValue(product.category);
    if (categoryId) {
      const existing = vuState.productIdsByCategory[categoryId] || [];
      if (!existing.includes(product._id)) {
        vuState.productIdsByCategory[categoryId] = [...existing, product._id];
      }
    }
  }

  return ids;
};

const ensureUserPoolCapacity = () => {
  if (vuState.poolValidated || !MIXED_WRITE_ENABLED) {
    return;
  }

  const poolInfo = getCredentialPoolInfo("user");
  if (poolInfo.size >= requiredUniqueUsers) {
    vuState.poolValidated = true;
    return;
  }

  const message =
    `Insufficient isolated user accounts for mixed-user cart writes: ` +
    `${poolInfo.size} account(s) for up to ${requiredUniqueUsers} VUs. ` +
    `Provide TEST_USER_EMAILS/TEST_USERS_JSON with at least ${requiredUniqueUsers} users, ` +
    `or set ALLOW_SHARED_TEST_USERS=true to reuse accounts.`;

  if (!ALLOW_SHARED_TEST_USERS) {
    exec.test.abort(message);
    return;
  }

  if (__VU === 1 && __ITER === 0) {
    console.warn(message);
  }

  vuState.poolValidated = true;
};

const loadBrowseData = () => {
  checkedRequest({
    method: "GET",
    path: "/api/user/homepage/banners",
    operation: "homepage_banners",
    endpoint: "/api/user/homepage/banners",
  });

  checkedRequest({
    method: "GET",
    path: "/api/user/homepage/announcements",
    operation: "homepage_announcements",
    endpoint: "/api/user/homepage/announcements",
  });

  const restaurants = checkedRequest({
    method: "GET",
    path: "/api/restaurants?page=1&limit=20",
    operation: "restaurants_list",
    endpoint: "/api/restaurants",
  });

  const restaurantIds = collectRestaurantIds(restaurants.body);
  if (restaurantIds.length > 0) {
    vuState.discoveredRestaurantIds = restaurantIds;
  }

  const restaurantId =
    pickRoundRobin(configuredRestaurantIds) ||
    pickRoundRobin(vuState.discoveredRestaurantIds) ||
    pickRandom(restaurantIds);

  if (restaurantId) {
    checkedRequest({
      method: "GET",
      path: `/api/restaurant/${restaurantId}`,
      operation: "restaurant_detail",
      endpoint: "/api/restaurant/:id",
    });

    const menu = checkedRequest({
      method: "GET",
      path: `/api/restaurants/${restaurantId}/menu`,
      operation: "restaurant_menu",
      endpoint: "/api/restaurants/:restaurantId/menu",
    });

    const menuItemIds = collectMenuItems(menu.body, restaurantId);
    if (menuItemIds.length > 0) {
      vuState.discoveredMenuItemIds = menuItemIds;
    }
  }

  checkedRequest({
    method: "GET",
    path: "/api/marketplace/categories?page=1&limit=20",
    operation: "marketplace_categories",
    endpoint: "/api/marketplace/categories",
  });

  const products = checkedRequest({
    method: "GET",
    path: "/api/marketplace/products?page=1&limit=20",
    operation: "marketplace_products",
    endpoint: "/api/marketplace/products",
  });

  const productIds = collectMarketplaceProducts(products.body);
  if (productIds.length > 0) {
    vuState.discoveredMarketplaceProductIds = productIds;
  }

  const productId =
    pickRoundRobin(configuredMarketplaceProductIds) ||
    pickRoundRobin(vuState.discoveredMarketplaceProductIds) ||
    pickRandom(productIds);

  if (productId) {
    checkedRequest({
      method: "GET",
      path: `/api/marketplace/products/${productId}`,
      operation: "marketplace_product_detail",
      endpoint: "/api/marketplace/products/:productId",
    });
  }
};

const getFoodCartSnapshot = (operation = "cart_get") => {
  const foodCart = checkedRequest({
    method: "GET",
    path: "/api/user/cart",
    operation,
    endpoint: "/api/user/cart",
  });

  const restaurantId = getIdValue(foodCart.body?.data?.restaurant);
  const itemIds = (foodCart.body?.data?.items || [])
    .map((item) => getIdValue(item?.menuItem))
    .filter(Boolean);

  if (itemIds.length > 0) {
    vuState.lastFoodItemId = pickRoundRobin(itemIds);
  }

  return {
    restaurantId,
    itemIds,
  };
};

const getMarketplaceCartSnapshot = (operation = "marketplace_cart_get") => {
  const marketCart = checkedRequest({
    method: "GET",
    path: "/api/marketplace/cart",
    operation,
    endpoint: "/api/marketplace/cart",
  });

  const categoryId = getIdValue(marketCart.body?.data?.category);
  const items = marketCart.body?.data?.items || [];
  const itemIds = items.map((item) => getIdValue(item?.product)).filter(Boolean);

  if (itemIds.length > 0) {
    vuState.lastMarketplaceProductId = pickRoundRobin(itemIds);
  }

  let resolvedCategoryId = categoryId;
  if (!resolvedCategoryId && items.length > 0) {
    resolvedCategoryId = getIdValue(items[0]?.product?.category);
  }

  return {
    categoryId: resolvedCategoryId,
    itemIds,
  };
};

const readCarts = () => {
  getFoodCartSnapshot("cart_get");
  getMarketplaceCartSnapshot("marketplace_cart_get");
};

const buildMetricTags = (operation, response) => {
  return {
    scenario: "mixed-user",
    operation,
    status: String(response.status),
    test_type: TEST_TYPE,
    ...getVuTags(),
  };
};

const trackFoodResult = ({ response, metric, operation }) => {
  if (response.status >= 400) {
    cartOperationErrors.add(1, buildMetricTags(operation, response));
    return false;
  }

  metric.add(1, buildMetricTags(operation, response));
  return true;
};

const trackMarketplaceResult = ({
  response,
  metric,
  operation,
}) => {
  if (response.status >= 400) {
    marketplaceCartOperationErrors.add(1, buildMetricTags(operation, response));
    return false;
  }

  metric.add(1, buildMetricTags(operation, response));
  return true;
};

const ensureMenuForRestaurant = (restaurantId) => {
  if (!restaurantId) {
    return [];
  }

  const known = vuState.menuItemIdsByRestaurant[restaurantId] || [];
  if (known.length > 0) {
    return known;
  }

  const menu = checkedRequest({
    method: "GET",
    path: `/api/restaurants/${restaurantId}/menu`,
    operation: "restaurant_menu_for_cart_write",
    endpoint: "/api/restaurants/:restaurantId/menu",
  });

  return collectMenuItems(menu.body, restaurantId);
};

const ensureProductsForCategory = (categoryId) => {
  if (!categoryId) {
    return [];
  }

  const known = vuState.productIdsByCategory[categoryId] || [];
  if (known.length > 0) {
    return known;
  }

  const products = checkedRequest({
    method: "GET",
    path: `/api/marketplace/products?page=1&limit=20&category=${categoryId}`,
    operation: "marketplace_products_for_cart_write",
    endpoint: "/api/marketplace/products",
  });

  return collectMarketplaceProducts(products.body).filter((productId) => {
    return (vuState.productIdsByCategory[categoryId] || []).includes(productId);
  });
};

const chooseFoodAddTarget = (cartSnapshot) => {
  if (cartSnapshot.restaurantId) {
    const restaurantMenuIds = ensureMenuForRestaurant(cartSnapshot.restaurantId);
    return pickRoundRobin(restaurantMenuIds) || pickRandom(restaurantMenuIds);
  }

  return (
    pickRoundRobin(configuredMenuItemIds) ||
    pickRoundRobin(vuState.discoveredMenuItemIds) ||
    pickRandom(vuState.discoveredMenuItemIds)
  );
};

const chooseMarketplaceAddTarget = (cartSnapshot) => {
  if (cartSnapshot.categoryId) {
    const categoryProductIds = ensureProductsForCategory(cartSnapshot.categoryId);
    return pickRoundRobin(categoryProductIds) || pickRandom(categoryProductIds);
  }

  return (
    pickRoundRobin(configuredMarketplaceProductIds) ||
    pickRoundRobin(vuState.discoveredMarketplaceProductIds) ||
    pickRandom(vuState.discoveredMarketplaceProductIds)
  );
};

const performFoodCartWrite = () => {
  const cartBefore = getFoodCartSnapshot("cart_get_before_food_write");

  if (cartBefore.itemIds.length > 0) {
    const existingItemId = pickRoundRobin(cartBefore.itemIds) || cartBefore.itemIds[0];
    const updatePayload = { quantity: 1 };
    const updateResult = checkedRequest({
      method: "PATCH",
      path: `/api/user/cart/items/${existingItemId}`,
      operation: "cart_update",
      endpoint: "/api/user/cart/items/:menuItemId",
      body: updatePayload,
      expectedStatuses: [200],
    });

    const updated = trackFoodResult({
      response: updateResult.response,
      metric: cartUpdateSuccess,
      operation: "cart_update",
      testDataId: existingItemId,
      requestPayload: updatePayload,
    });

    getFoodCartSnapshot("cart_get_after_food_update");

    if (!updated) {
      return;
    }

    const deleteResult = checkedRequest({
      method: "DELETE",
      path: `/api/user/cart/items/${existingItemId}`,
      operation: "cart_delete",
      endpoint: "/api/user/cart/items/:menuItemId",
      expectedStatuses: [200],
    });

    trackFoodResult({
      response: deleteResult.response,
      metric: cartDeleteSuccess,
      operation: "cart_delete",
      testDataId: existingItemId,
    });

    getFoodCartSnapshot("cart_get_after_food_delete");
    return;
  }

  const addTargetId = chooseFoodAddTarget(cartBefore);
  if (!addTargetId) {
    return;
  }

  const addPayload = {
    menuItemId: addTargetId,
    quantity: 1,
  };
  const addResult = checkedRequest({
    method: "POST",
    path: "/api/user/cart/items",
    operation: "cart_add",
    endpoint: "/api/user/cart/items",
    body: addPayload,
    expectedStatuses: [201],
  });

  const added = trackFoodResult({
    response: addResult.response,
    metric: cartAddSuccess,
    operation: "cart_add",
    testDataId: addTargetId,
    requestPayload: addPayload,
  });

  if (!added) {
    return;
  }

  const cartAfterAdd = getFoodCartSnapshot("cart_get_after_food_add");
  const itemId = cartAfterAdd.itemIds.includes(addTargetId)
    ? addTargetId
    : pickRoundRobin(cartAfterAdd.itemIds);

  if (!itemId) {
    return;
  }

  const updatePayload = { quantity: 1 };
  const updateResult = checkedRequest({
    method: "PATCH",
    path: `/api/user/cart/items/${itemId}`,
    operation: "cart_update",
    endpoint: "/api/user/cart/items/:menuItemId",
    body: updatePayload,
    expectedStatuses: [200],
  });

  const updated = trackFoodResult({
    response: updateResult.response,
    metric: cartUpdateSuccess,
    operation: "cart_update",
    testDataId: itemId,
    requestPayload: updatePayload,
  });

  getFoodCartSnapshot("cart_get_after_food_update");

  if (!updated) {
    return;
  }

  const deleteResult = checkedRequest({
    method: "DELETE",
    path: `/api/user/cart/items/${itemId}`,
    operation: "cart_delete",
    endpoint: "/api/user/cart/items/:menuItemId",
    expectedStatuses: [200],
  });

  trackFoodResult({
    response: deleteResult.response,
    metric: cartDeleteSuccess,
    operation: "cart_delete",
    testDataId: itemId,
  });

  getFoodCartSnapshot("cart_get_after_food_delete");
};

const performMarketplaceCartWrite = () => {
  const cartBefore = getMarketplaceCartSnapshot("marketplace_cart_get_before_write");

  if (cartBefore.itemIds.length > 0) {
    const existingProductId = pickRoundRobin(cartBefore.itemIds) || cartBefore.itemIds[0];
    const updatePayload = { quantity: 1 };
    const updateResult = checkedRequest({
      method: "PATCH",
      path: `/api/marketplace/cart/items/${existingProductId}`,
      operation: "marketplace_cart_update",
      endpoint: "/api/marketplace/cart/items/:productId",
      body: updatePayload,
      expectedStatuses: [200],
    });

    const updated = trackMarketplaceResult({
      response: updateResult.response,
      metric: marketplaceCartUpdateSuccess,
      operation: "marketplace_cart_update",
      testDataId: existingProductId,
      requestPayload: updatePayload,
    });

    getMarketplaceCartSnapshot("marketplace_cart_get_after_update");

    if (!updated) {
      return;
    }

    const deleteResult = checkedRequest({
      method: "DELETE",
      path: `/api/marketplace/cart/items/${existingProductId}`,
      operation: "marketplace_cart_delete",
      endpoint: "/api/marketplace/cart/items/:productId",
      expectedStatuses: [200],
    });

    trackMarketplaceResult({
      response: deleteResult.response,
      metric: marketplaceCartDeleteSuccess,
      operation: "marketplace_cart_delete",
      testDataId: existingProductId,
    });

    getMarketplaceCartSnapshot("marketplace_cart_get_after_delete");
    return;
  }

  const addTargetId = chooseMarketplaceAddTarget(cartBefore);
  if (!addTargetId) {
    return;
  }

  const addPayload = {
    productId: addTargetId,
    quantity: 1,
  };
  const addResult = checkedRequest({
    method: "POST",
    path: "/api/marketplace/cart",
    operation: "marketplace_cart_add",
    endpoint: "/api/marketplace/cart",
    body: addPayload,
    expectedStatuses: [201],
  });

  const added = trackMarketplaceResult({
    response: addResult.response,
    metric: marketplaceCartAddSuccess,
    operation: "marketplace_cart_add",
    testDataId: addTargetId,
    requestPayload: addPayload,
  });

  if (!added) {
    return;
  }

  const cartAfterAdd = getMarketplaceCartSnapshot("marketplace_cart_get_after_add");
  const productId = cartAfterAdd.itemIds.includes(addTargetId)
    ? addTargetId
    : pickRoundRobin(cartAfterAdd.itemIds);

  if (!productId) {
    return;
  }

  const updatePayload = { quantity: 1 };
  const updateResult = checkedRequest({
    method: "PATCH",
    path: `/api/marketplace/cart/items/${productId}`,
    operation: "marketplace_cart_update",
    endpoint: "/api/marketplace/cart/items/:productId",
    body: updatePayload,
    expectedStatuses: [200],
  });

  const updated = trackMarketplaceResult({
    response: updateResult.response,
    metric: marketplaceCartUpdateSuccess,
    operation: "marketplace_cart_update",
    testDataId: productId,
    requestPayload: updatePayload,
  });

  getMarketplaceCartSnapshot("marketplace_cart_get_after_update");

  if (!updated) {
    return;
  }

  const deleteResult = checkedRequest({
    method: "DELETE",
    path: `/api/marketplace/cart/items/${productId}`,
    operation: "marketplace_cart_delete",
    endpoint: "/api/marketplace/cart/items/:productId",
    expectedStatuses: [200],
  });

  trackMarketplaceResult({
    response: deleteResult.response,
    metric: marketplaceCartDeleteSuccess,
    operation: "marketplace_cart_delete",
    testDataId: productId,
  });

  getMarketplaceCartSnapshot("marketplace_cart_get_after_delete");
};

const performCartWrites = () => {
  if (!MIXED_WRITE_ENABLED) {
    return;
  }

  const writeTarget = Math.random() < 0.5 ? "food" : "marketplace";
  if (writeTarget === "food") {
    performFoodCartWrite();
  } else {
    performMarketplaceCartWrite();
  }

  readCarts();
};

const cleanupTouchedItems = () => {
  if (!MIXED_WRITE_ENABLED) {
    return;
  }

  const foodCart = getFoodCartSnapshot("cart_get_before_cleanup");
  const foodItemId = pickRoundRobin(foodCart.itemIds);
  if (foodItemId) {
    const foodDelete = checkedRequest({
      method: "DELETE",
      path: `/api/user/cart/items/${foodItemId}`,
      operation: "cart_delete",
      endpoint: "/api/user/cart/items/:menuItemId",
      expectedStatuses: [200],
      requireData: true,
      requireSuccess: true,
    });

    trackFoodResult({
      response: foodDelete.response,
      metric: cartDeleteSuccess,
      operation: "cart_delete",
      testDataId: foodItemId,
    });
  }

  const marketCart = getMarketplaceCartSnapshot("marketplace_cart_get_before_cleanup");
  const marketItemId = pickRoundRobin(marketCart.itemIds);
  if (marketItemId) {
    const marketDelete = checkedRequest({
      method: "DELETE",
      path: `/api/marketplace/cart/items/${marketItemId}`,
      operation: "marketplace_cart_delete",
      endpoint: "/api/marketplace/cart/items/:productId",
      expectedStatuses: [200],
      requireData: true,
      requireSuccess: true,
    });

    trackMarketplaceResult({
      response: marketDelete.response,
      metric: marketplaceCartDeleteSuccess,
      operation: "marketplace_cart_delete",
      testDataId: marketItemId,
    });
  }

  readCarts();
};

export default function () {
  ensureUserPoolCapacity();

  if (__ITER === 0 || __ITER % 10 === 0) {
    checkedRequest({
      method: "GET",
      path: "/api/auth/me",
      operation: "profile_me",
      endpoint: "/api/auth/me",
    });
  }

  const selectedOperation = weightedOperation();
  if (selectedOperation === "read_browse") {
    loadBrowseData();
  } else if (selectedOperation === "cart_read") {
    readCarts();
  } else if (selectedOperation === "cart_write") {
    performCartWrites();
  } else {
    cleanupTouchedItems();
  }

  sleep(sleepRange(1, 3));
}
