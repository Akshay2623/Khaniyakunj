const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema(
  {
    courierCompany: { type: String, required: true, trim: true },
    packageType: { type: String, required: true, trim: true },
    residentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', default: null, index: true },
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Society', required: true, index: true },
    receivedByGuard: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receivedTime: { type: Date, default: Date.now },
    deliveredTime: { type: Date, default: null },
    status: { type: String, enum: ['Received', 'Delivered'], default: 'Received', index: true },
  },
  { timestamps: true }
);

deliverySchema.index({ societyId: 1, createdAt: -1 });
deliverySchema.index({ residentId: 1, createdAt: -1 });

module.exports = mongoose.model('Delivery', deliverySchema);
