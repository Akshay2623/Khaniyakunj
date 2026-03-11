const mongoose = require('mongoose');

const lostItemSchema = new mongoose.Schema(
  {
    itemName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    locationFound: {
      type: String,
      required: true,
      trim: true,
    },
    dateFound: {
      type: Date,
      required: true,
    },
    image: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    foundByGuard: {
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
    status: {
      type: String,
      enum: ['FOUND', 'CLAIMED'],
      default: 'FOUND',
      index: true,
    },
    claimedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

lostItemSchema.index({ societyId: 1, status: 1, createdAt: -1 });
lostItemSchema.index({ societyId: 1, dateFound: -1 });

module.exports = mongoose.model('LostItem', lostItemSchema);
