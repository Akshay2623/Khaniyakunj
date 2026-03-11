const mongoose = require('mongoose');

const vehicleLogSchema = new mongoose.Schema(
  {
    vehicleNumber: { type: String, required: true, trim: true, uppercase: true, index: true },
    vehicleType: { type: String, enum: ['Car', 'Bike', 'Delivery Van'], required: true },
    driverName: { type: String, required: true, trim: true },
    purpose: { type: String, trim: true, default: '' },
    visitingUnit: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', default: null },
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Society', required: true, index: true },
    entryTime: { type: Date, default: Date.now, index: true },
    exitTime: { type: Date, default: null },
    createdByGuard: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

vehicleLogSchema.index({ societyId: 1, createdAt: -1 });
vehicleLogSchema.index({ societyId: 1, vehicleNumber: 1, entryTime: -1 });

module.exports = mongoose.model('VehicleLog', vehicleLogSchema);
