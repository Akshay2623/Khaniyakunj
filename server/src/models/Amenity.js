const mongoose = require('mongoose');

const amenitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    location: {
      type: String,
      trim: true,
      default: '',
    },
    capacity: {
      type: Number,
      min: 1,
      default: 1,
    },
    pricePerHour: {
      type: Number,
      min: 0,
      default: 0,
    },
    openingTime: {
      type: String,
      required: true,
      default: '06:00',
    },
    closingTime: {
      type: String,
      required: true,
      default: '22:00',
    },
    bookingRequired: {
      type: Boolean,
      default: true,
    },
    approvalRequired: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    societyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Society',
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

amenitySchema.index({ societyId: 1, name: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });

module.exports = mongoose.model('Amenity', amenitySchema);

