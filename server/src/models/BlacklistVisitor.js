const mongoose = require('mongoose');

const blacklistVisitorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    reason: { type: String, required: true, trim: true },
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Society', required: true, index: true },
    addedByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

blacklistVisitorSchema.index({ societyId: 1, phone: 1 }, { unique: true });

module.exports = mongoose.model('BlacklistVisitor', blacklistVisitorSchema);
