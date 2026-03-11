const mongoose = require('mongoose');

const noticeReadSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    readAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const noticeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
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
    isPinned: {
      type: Boolean,
      default: false,
    },
    attachments: {
      type: [String],
      default: [],
    },
    readBy: {
      type: [noticeReadSchema],
      default: [],
    },
  },
  { timestamps: true }
);

noticeSchema.index({ societyId: 1, isPinned: -1, createdAt: -1 });
noticeSchema.index({ societyId: 1, 'readBy.userId': 1 });

const Notice = mongoose.model('Notice', noticeSchema);

module.exports = Notice;