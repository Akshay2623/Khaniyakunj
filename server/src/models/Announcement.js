const mongoose = require('mongoose');

const TARGET_ROLES = ['ALL', 'RESIDENTS', 'COMMITTEE_MEMBERS', 'COMMITTEE', 'GUARDS', 'TENANTS'];

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    targetRole: { type: String, enum: TARGET_ROLES, default: 'ALL', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Society', required: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

announcementSchema.index({ societyId: 1, isActive: 1, startDate: 1, endDate: 1, targetRole: 1 });

module.exports = mongoose.model('Announcement', announcementSchema);
module.exports.TARGET_ROLES = TARGET_ROLES;
