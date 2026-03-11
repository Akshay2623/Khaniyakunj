const mongoose = require('mongoose');

const residentActivitySchema = new mongoose.Schema(
  {
    residentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    societyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Society',
      default: null,
      index: true,
    },
    activityType: {
      type: String,
      enum: ['PAYMENT_MADE', 'COMPLAINT_SUBMITTED', 'VISITOR_APPROVED', 'PROFILE_UPDATED', 'PRIVACY_DND_UPDATED'],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

residentActivitySchema.index({ residentId: 1, createdAt: -1 });

const ResidentActivity = mongoose.model('ResidentActivity', residentActivitySchema);

module.exports = ResidentActivity;
