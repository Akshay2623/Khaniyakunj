const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, trim: true, default: '' },
    line2: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    postalCode: { type: String, trim: true, default: '' },
    country: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const societySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    legalName: { type: String, trim: true, default: '' },
    registrationNumber: { type: String, trim: true, default: undefined },
    taxIdentificationNumber: { type: String, trim: true, default: undefined },
    address: { type: addressSchema, default: () => ({}) },
    timezone: { type: String, trim: true, default: 'UTC' },
    currency: { type: String, trim: true, uppercase: true, default: 'USD' },
    contactEmail: { type: String, trim: true, lowercase: true, default: '' },
    contactPhone: { type: String, trim: true, default: '' },
    website: { type: String, trim: true, default: '' },
    logoUrl: { type: String, trim: true, default: '' },
    totalUnits: { type: Number, min: 0, default: 0 },
    totalBuildings: { type: Number, min: 0, default: 0 },
    status: {
      type: String,
      enum: ['Active', 'Suspended', 'Archived'],
      default: 'Active',
    },
    subscriptionPlan: {
      type: String,
      enum: ['Basic', 'Pro', 'Enterprise'],
      default: 'Basic',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

societySchema.index({ name: 1 });
societySchema.index({ registrationNumber: 1 }, { sparse: true, unique: true });
societySchema.index({ status: 1 });

const Society = mongoose.model('Society', societySchema);

module.exports = Society;
