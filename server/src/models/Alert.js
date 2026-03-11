const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    priority: {
      type: String,
      enum: ['Normal', 'Urgent', 'Critical'],
      default: 'Normal',
      index: true,
    },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    targetRole: {
      type: String,
      enum: ['ALL', 'RESIDENTS', 'GUARDS', 'TENANTS', 'COMMITTEE'],
      default: 'ALL',
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Society', required: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

alertSchema.index({ societyId: 1, isActive: 1, startDate: 1, endDate: 1, targetRole: 1, priority: 1 });

module.exports = mongoose.model('Alert', alertSchema);

