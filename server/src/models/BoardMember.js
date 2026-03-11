const mongoose = require('mongoose');

const boardMemberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    designation: {
      type: String,
      enum: ['President', 'Secretary', 'Treasurer', 'Board Member'],
      required: true,
    },
    email: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Society', required: true, index: true },
    termStartDate: { type: Date, default: null },
    termEndDate: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

boardMemberSchema.index({ societyId: 1, email: 1 }, { sparse: true });

module.exports = mongoose.model('BoardMember', boardMemberSchema);
