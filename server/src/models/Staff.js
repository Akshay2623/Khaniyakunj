const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema(
  {
    name: {
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
    photo: {
      type: String,
      trim: true,
      default: '',
    },
    workType: {
      type: String,
      required: true,
      enum: ['maid', 'cook', 'driver', 'nanny', 'other'],
      index: true,
    },
    houseNumber: {
      type: String,
      required: true,
      trim: true,
    },
    residentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    workingDays: {
      type: [String],
      default: [],
    },
    expectedEntryTime: {
      type: String,
      trim: true,
      default: '',
    },
    expectedExitTime: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'blocked', 'inactive'],
      default: 'active',
      index: true,
    },
    createdByResident: {
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

staffSchema.index({ societyId: 1, residentId: 1, createdAt: -1 });
staffSchema.index({ societyId: 1, phone: 1 }, { unique: true });

module.exports = mongoose.model('Staff', staffSchema);
