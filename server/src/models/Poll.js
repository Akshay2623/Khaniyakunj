const mongoose = require('mongoose');

const pollOptionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    voteCount: { type: Number, default: 0, min: 0 },
    voters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { _id: true }
);

const pollSchema = new mongoose.Schema(
  {
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Society', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    options: { type: [pollOptionSchema], validate: [(rows) => Array.isArray(rows) && rows.length >= 2, 'At least two options required.'] },
    status: { type: String, enum: ['ACTIVE', 'CLOSED'], default: 'ACTIVE', index: true },
    startAt: { type: Date, default: null, index: true },
    endAt: { type: Date, default: null, index: true },
    expiresAt: { type: Date, default: null, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

pollSchema.index({ societyId: 1, createdAt: -1 });

module.exports = mongoose.model('Poll', pollSchema);
