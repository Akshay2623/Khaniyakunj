const mongoose = require('mongoose');

const amenityBookingSchema = new mongoose.Schema(
  {
    amenityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Amenity',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit',
      default: null,
      index: true,
    },
    societyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Society',
      required: true,
      index: true,
    },
    bookingDate: {
      type: Date,
      required: true,
      index: true,
    },
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    totalGuests: {
      type: Number,
      min: 1,
      default: 1,
    },
    specialRequest: {
      type: String,
      trim: true,
      default: '',
    },
    bookingStatus: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'Completed'],
      default: 'Pending',
      index: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

amenityBookingSchema.index({ societyId: 1, amenityId: 1, bookingDate: 1, bookingStatus: 1 });
amenityBookingSchema.index({ societyId: 1, userId: 1, bookingDate: -1 });

module.exports = mongoose.model('AmenityBooking', amenityBookingSchema);

