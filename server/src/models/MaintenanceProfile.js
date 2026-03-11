const mongoose = require('mongoose');

const maintenanceProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    societyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Society',
      required: true,
      index: true,
    },
    billingEnabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    includedInNextCycle: {
      type: Boolean,
      default: true,
    },
    profileStatus: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },
    nextBillingCycleMonth: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

maintenanceProfileSchema.index({ societyId: 1, billingEnabled: 1 });

module.exports = mongoose.model('MaintenanceProfile', maintenanceProfileSchema);
