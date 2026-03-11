const mongoose = require('mongoose');

const emergencyAlertSchema = new mongoose.Schema(
  {
    alertType: { type: String, enum: ['Medical', 'Fire', 'Security'], required: true, index: true },
    description: { type: String, required: true, trim: true },
    reportedByUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Backward compatibility for older records created by guard-only flow.
    reportedByGuard: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    location: { type: String, required: true, trim: true },
    status: { type: String, enum: ['ACTIVE', 'RESOLVED'], default: 'ACTIVE', index: true },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Society', required: true, index: true },
  },
  { timestamps: true }
);

emergencyAlertSchema.index({ societyId: 1, createdAt: -1 });

module.exports = mongoose.model('EmergencyAlert', emergencyAlertSchema);
