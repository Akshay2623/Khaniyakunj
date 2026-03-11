const mongoose = require('mongoose');

const staffEntryLogSchema = new mongoose.Schema(
  {
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      required: true,
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
    entryTime: {
      type: Date,
      required: true,
      index: true,
    },
    exitTime: {
      type: Date,
      default: null,
    },
    date: {
      type: String,
      required: true,
      index: true,
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

staffEntryLogSchema.index({ societyId: 1, date: -1, createdAt: -1 });

module.exports = mongoose.model('StaffEntryLog', staffEntryLogSchema);
