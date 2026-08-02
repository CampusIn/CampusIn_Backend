import mongoose from "mongoose";

const marketplacePricingSettingsSchema = new mongoose.Schema(
  {
    deliveryCharge: {
      type: Number,
      required: true,
      min: [0, "Delivery charge cannot be negative"],
    },
    freeDeliveryAbove: {
      type: Number,
      required: true,
      min: [0, "Free delivery amount cannot be negative"],
    },
    minimumOrderValue: {
      type: Number,
      required: true,
      min: [0, "Minimum order value cannot be negative"],
    },
    gstPercentage: {
      type: Number,
      required: true,
      min: [0, "GST cannot be negative"],
      max: [100, "GST cannot be more than 100"],
    },
    packagingCharge: {
      type: Number,
      required: true,
      min: [0, "Packaging charges cannot be negative"],
    },
    platformCharge: {
      type: Number,
      required: true,
      min: [0, "Platform charges cannot be negative"],
    },
  },
  {
    _id: false,
  },
);

const marketPlaceCategorySchema = new mongoose.Schema({
    name:{
        type:String,
        required:[true,'Category name is required'],
        trim: true
    },
    description:{
        type:String,
        trim:true
    },
    image:{
        type:String,
        required:[true,'Image is required']
    },
    priority:{
        type:Number,
        default:1
    },
    isActive:{
        type:Boolean,
        default:true
    },
    createdBy:{
        type: mongoose.Schema.Types.ObjectId,
        ref:'User',
        required:true
    },
    pricingSettings: {
        type: marketplacePricingSettingsSchema,
        required: true
    }
},{
    timestamps:true
})

marketPlaceCategorySchema.pre("validate", function ensureMarketplaceThresholds() {
    if (
        this.pricingSettings &&
        this.pricingSettings.freeDeliveryAbove < this.pricingSettings.minimumOrderValue
    ) {
        this.invalidate(
            "pricingSettings.freeDeliveryAbove",
            "Minimum order value cannot be above free delivery order value",
        )
    }
})

marketPlaceCategorySchema.index({
    name:1
},{
    unique:true
})

marketPlaceCategorySchema.index({
    priority:-1,
    createdAt:-1
})

const marketPlaceCategoryModel = mongoose.model('MarketPlaceCategory',marketPlaceCategorySchema)

export default marketPlaceCategoryModel
