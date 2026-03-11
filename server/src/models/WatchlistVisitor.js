const mongoose = require('mongoose');

const watchlistVisitorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    notes: { type: String, trim: true, default: '' },
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Society', required: true, index: true },
    addedByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

watchlistVisitorSchema.index({ societyId: 1, phone: 1 }, { unique: true });

module.exports = mongoose.model('WatchlistVisitor', watchlistVisitorSchema);
