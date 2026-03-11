const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES, getRoleValues } = require('../constants/roles');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    languagePreference: {
      type: String,
      trim: true,
      default: 'en-US',
    },
    timezone: {
      type: String,
      trim: true,
      default: 'UTC',
    },
    password: {
      type: String,
      required: true,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
      index: true,
    },
    passwordChangedAt: {
      type: Date,
      default: null,
    },
    temporaryPasswordIssuedAt: {
      type: Date,
      default: null,
    },
    role: {
      type: String,
      required: true,
      enum: getRoleValues(),
      default: ROLES.TENANT,
    },
    societyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Society',
      default: null,
    },
    buildingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Building',
      default: null,
    },
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit',
      default: null,
      index: true,
    },
    flatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Suspended'],
      default: 'Active',
      index: true,
    },
    onboardingStatus: {
      type: String,
      enum: ['Pending', 'Completed'],
      default: 'Pending',
    },
    onboardingWorkflow: {
      profileCreated: { type: Boolean, default: false },
      unitAssigned: { type: Boolean, default: false },
      activated: { type: Boolean, default: false },
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    movedOutAt: {
      type: Date,
      default: null,
    },
    emergencyContact: {
      type: String,
      trim: true,
      default: '',
    },
    profileImageUrl: {
      type: String,
      trim: true,
      default: '',
    },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true },
    },
    uiPreferences: {
      darkMode: { type: Boolean, default: false },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    residentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resident',
      default: null,
    },
    dndEnabled: {
      type: Boolean,
      default: false,
      index: true,
    },
    dndExpiryTime: {
      type: Date,
      default: null,
      index: true,
    },
    resetPasswordToken: {
      type: String,
      default: null,
      index: true,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
  this.passwordChangedAt = new Date();
});

userSchema.pre('save', function syncStatusAndActive() {
  if (this.isModified('status')) {
    this.isActive = this.status === 'Active';
  } else if (this.isModified('isActive')) {
    this.status = this.isActive ? 'Active' : 'Inactive';
  }
});

userSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.index({ societyId: 1 });

const User = mongoose.model('User', userSchema);

module.exports = User;
