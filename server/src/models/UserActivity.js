const mongoose = require('mongoose');

const userActivitySchema = new mongoose.Schema(
  {
    userId: {
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
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    activityType: {
      type: String,
      enum: [
        'USER_CREATED',
        'UNIT_ASSIGNED',
        'ROLE_CHANGED',
        'MOVED_OUT',
        'DEACTIVATED',
        'PROFILE_UPDATED',
        'USER_DELETED',
      ],
      required: true,
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

userActivitySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('UserActivity', userActivitySchema);
