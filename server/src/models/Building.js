const mongoose = require('mongoose');

const buildingSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Society', required: true, index: true },
    totalFloors: { type: Number, min: 0, default: 0 },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

buildingSchema.index({ societyId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Building', buildingSchema);
