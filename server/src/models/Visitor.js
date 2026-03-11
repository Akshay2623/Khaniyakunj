const mongoose = require('mongoose');

const visitorSchema = new mongoose.Schema(
  {
    visitorName: {
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
    purpose: {
      type: String,
      trim: true,
      default: '',
    },
    vehicleNumber: {
      type: String,
      trim: true,
      default: '',
    },
    photoUrl: {
      type: String,
      trim: true,
      default: '',
    },
    visitingUnit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit',
      default: null,
      index: true,
    },
    residentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    societyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Society',
      required: true,
      index: true,
    },
    entryTime: {
      type: Date,
      default: null,
    },
    requestedEntryTime: {
      type: Date,
      default: null,
    },
    exitTime: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'Expected', 'Entered', 'Exited'],
      default: 'Pending',
    },
    approvedByResident: {
      type: Boolean,
      default: false,
    },
    createdByGuard: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    qrApprovalCode: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    qrCodeToken: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    lateNightEntry: {
      type: Boolean,
      default: false,
      index: true,
    },
    watchlistMatched: {
      type: Boolean,
      default: false,
      index: true,
    },
    watchlistNotes: {
      type: String,
      trim: true,
      default: '',
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: '',
    },
    isEmergency: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

visitorSchema.index({ societyId: 1, createdAt: -1 });
visitorSchema.index({ societyId: 1, status: 1, entryTime: -1 });
visitorSchema.index({ residentId: 1, createdAt: -1 });
visitorSchema.index({ societyId: 1, phone: 1, entryTime: -1 });

const Visitor = mongoose.model('Visitor', visitorSchema);

module.exports = Visitor;
