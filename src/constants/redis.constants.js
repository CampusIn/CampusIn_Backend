export const REDIS_KEYS = {
    OTP: "otp",
    SEND_OTP:"SEND_OTP",
    WELCOME:"WELCOME",
    FORGOT_PASSWORD:"FORGOT_PASSWORD",
    REPAIR_REQUEST_ESTIMATE:"REPAIR_REQUEST_ESTIMATE",
    REMINDER:"REMINDER",
    VENDOR_NEW_ORDER:"VENDOR_NEW_ORDER",
    ADMIN_MARKETPLACE_NEW_ORDER:"ADMIN_MARKETPLACE_NEW_ORDER",
    DELIVERY_ASSIGNMENT:"DELIVERY_ASSIGNMENT",
    ADMIN_REPAIR_REQUEST_SUBMITTED:"ADMIN_REPAIR_REQUEST_SUBMITTED",
    ADMIN_REPAIR_PRICE_DECISION:"ADMIN_REPAIR_PRICE_DECISION",
    PRINTING_ORDER_CREATED:"PRINTING_ORDER_CREATED",
    PRINTING_ORDER_STATUS_UPDATED:"PRINTING_ORDER_STATUS_UPDATED",
    ADMIN_PRINTING_ORDER_CREATED:"ADMIN_PRINTING_ORDER_CREATED",
    COOLDOWN_KEY:"cooldown",
    RESET:"reset",
    PLATFORM_SETTINGS:"paltform-settings",
    BANNERS:"banners",
    ANNOUNCEMENTS:"announcements",
    REVIEW: function review(restaurantId, page, limit) {
        return `reviews:restaurant:${restaurantId}:page:${page}:limit:${limit}`
    },
    REVIEW_PATTERN: function reviewPattern(restaurantId) {
        return `reviews:restaurant:${restaurantId}:*`
    },
    COUPON:"coupon",
    MARKETPLACE_PRODUCTS_ID:function products(id){
        return `market-place:products:${id}`
    },
    MARKETPLACE_PRODUCTS: function products(page, limit, search = "", category = "", condition = "", minPrice = "", maxPrice = "") {
        return `market-place:products:page:${page}:limit:${limit}:search:${search || "all"}:category:${category || "all"}:condition:${condition || "all"}:minPrice:${minPrice || "all"}:maxPrice:${maxPrice || "all"}`
    },
    MARKETPLACE_PRODUCTS_PATTERN:"market-place:products:page:*",
    MARKETPLACE_PRODUCTS_SUGGESTIONS: function marketPlaceProductsSuggestions(query) {
        return `market-place:products:suggestions:query:${query || "all"}`
    },
    MARKETPLACE_PRODUCTS_SUGGESTIONS_PATTERN:"market-place:products:suggestions:*",
    CATEGORIES: function categories(page, limit, search = "") {
        return `categories:page:${page}:limit:${limit}:search:${search || "all"}`
    },
    CATEGORIES_PATTERN:"categories:*",
    RESTAURANT_KEY: function restaurant(restaurantId){
        return `restaurant:${restaurantId}`
    },
    RESTAURANTS: function restaurants(page, limit, search = "", category = "") {
        return `restaurants:page:${page}:limit:${limit}:search:${search || "all"}:category:${category || "all"}`
    },
    RESTAURANTS_PATTERN:"restaurants:*",

    MENU_KEY: function restaurantMenu(restaurantId){
        return `restaurant:${restaurantId}:menu`
    },
    USER_FOOD_ORDER_HISTORY: function userFoodOrderHistory(userId, page, limit) {
        return `orders:user:${userId}:page:${page}:limit:${limit}`
    },
    USER_FOOD_ORDER_HISTORY_PATTERN: function userFoodOrderHistoryPattern(userId) {
        return `orders:user:${userId}:*`
    },
    USER_MARKETPLACE_ORDER_HISTORY: function userMarketplaceOrderHistory(userId, page, limit) {
        return `market-place:orders:user:${userId}:page:${page}:limit:${limit}`
    },
    USER_MARKETPLACE_ORDER_HISTORY_PATTERN: function userMarketplaceOrderHistoryPattern(userId) {
        return `market-place:orders:user:${userId}:*`
    },
    USER_REPAIR_REQUESTS: function userRepairRequests(userId, page, limit, search = "all", status = "all") {
        return `repair-requests:user:${userId}:page:${page}:limit:${limit}:search:${search || "all"}:status:${status || "all"}`
    },
    USER_REPAIR_REQUESTS_PATTERN: function userRepairRequestsPattern(userId) {
        return `repair-requests:user:${userId}:*`
    },
    USER_REPAIR_REQUEST_DETAILS: function userRepairRequestDetails(userId, requestId) {
        return `repair-requests:user:${userId}:request:${requestId}`
    }
}

export const OTP_EXPIRY = 300 // 5 minutes expiration time
