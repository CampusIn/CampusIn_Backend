export const REDIS_KEYS = {
    OTP: "otp",
    SEND_OTP:"SEND_OTP",
    WELCOME:"WELCOME",
    FORGOT_PASSWORD:"FORGOT_PASSWORD",
    REPAIR_REQUEST_ESTIMATE:"REPAIR_REQUEST_ESTIMATE",
    REMINDER:"REMINDER",
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
    }
}

export const OTP_EXPIRY = 300 // 5 minutes expiration time
