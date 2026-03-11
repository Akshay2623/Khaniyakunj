const mongoose = require('mongoose');

const deliveryEntrySchema = new mongoose.Schema(
  {
    deliveryPersonName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    deliveryType: {
      type: String,
      required: true,
      trim: true,
      default: 'Other',
    },
    flatNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    residentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    otp: {
      type: String,
      trim: true,
      default: '',
    },
    otpExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    otpVerifiedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Entered', 'Exited'],
      default: 'Pending',
      index: true,
    },
    entryTime: {
      type: Date,
      default: null,
    },
    exitTime: {
      type: Date,
      default: null,
    },
    guardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    societyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Society',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

deliveryEntrySchema.index({ societyId: 1, flatNumber: 1, createdAt: -1 });
deliveryEntrySchema.index({ societyId: 1, residentId: 1, createdAt: -1 });

module.exports = mongoose.model('DeliveryEntry', deliveryEntrySchema);
