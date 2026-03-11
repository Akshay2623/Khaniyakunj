const mongoose = require('mongoose');

const userInviteSchema = new mongoose.Schema(
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
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    inviteToken: {
      type: String,
      required: true,
      index: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'SENT', 'ACCEPTED', 'EXPIRED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    locale: {
      type: String,
      trim: true,
      default: 'en-US',
    },
    timezone: {
      type: String,
      trim: true,
      default: 'UTC',
    },
    firstLoginResetRequired: {
      type: Boolean,
      default: true,
    },
    temporaryPassword: {
      type: String,
      trim: true,
      default: '',
    },
    provider: {
      type: String,
      trim: true,
      default: 'internal',
    },
    providerMessage: {
      type: String,
      trim: true,
      default: '',
    },
    lastSentAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserInvite', userInviteSchema);
