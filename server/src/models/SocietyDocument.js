const mongoose = require('mongoose');

const societyDocumentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['Bylaws', 'Financial Report', 'Meeting Minutes', 'Compliance', 'Legal'],
      required: true,
    },
    fileUrl: { type: String, required: true, trim: true },
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Society', required: true, index: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    version: { type: Number, min: 1, default: 1 },
    visibility: {
      type: String,
      enum: ['BoardOnly', 'Residents', 'Public'],
      default: 'Residents',
    },
    uploadedAt: { type: Date, default: Date.now },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

societyDocumentSchema.index({ societyId: 1, category: 1, uploadedAt: -1 });

module.exports = mongoose.model('SocietyDocument', societyDocumentSchema);
