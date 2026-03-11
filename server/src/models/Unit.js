const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema(
  {
    wing: { type: String, trim: true, default: '' },
    flatNumber: { type: String, trim: true, default: '' },
    unitNumber: { type: String, required: true, trim: true },
    floorNumber: { type: Number, min: 0, default: 0 },
    buildingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Building', default: null },
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Society', required: true, index: true },
    unitType: {
      type: String,
      enum: ['Studio', '1BR', '2BR', '3BR', 'Penthouse', '1BHK', '2BHK', '3BHK', 'Villa', 'Other'],
      default: '2BHK',
    },
    squareFootage: { type: Number, min: 0, default: 0 },
    status: {
      type: String,
      enum: ['VACANT', 'OCCUPIED', 'INACTIVE'],
      default: 'VACANT',
      index: true,
    },
    occupancyStatus: {
      type: String,
      enum: ['Vacant', 'Occupied'],
      default: 'Vacant',
    },
    assignedResidentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

unitSchema.pre('validate', function syncFlatFields(next) {
  const wing = String(this.wing || '').trim().toUpperCase();
  const flat = String(this.flatNumber || '').trim().toUpperCase();
  const unit = String(this.unitNumber || '').trim().toUpperCase();

  if (!flat && unit) {
    this.flatNumber = unit;
  } else if (flat) {
    this.flatNumber = flat;
  }

  this.wing = wing;
  const normalizedFlat = String(this.flatNumber || '').trim().toUpperCase();
  this.unitNumber = wing && normalizedFlat ? `${wing}-${normalizedFlat}` : normalizedFlat || unit;
  next();
});

unitSchema.pre('save', function syncLegacyOccupancy(next) {
  if (this.status === 'INACTIVE') {
    this.occupancyStatus = this.occupancyStatus === 'Occupied' ? 'Occupied' : 'Vacant';
    return next();
  }
  if (this.status === 'OCCUPIED') {
    this.occupancyStatus = 'Occupied';
  } else {
    this.occupancyStatus = 'Vacant';
  }
  next();
});

unitSchema.index({ societyId: 1, unitNumber: 1 }, { unique: true });
unitSchema.index({ societyId: 1, wing: 1, flatNumber: 1 }, { unique: true });
unitSchema.index({ societyId: 1, occupancyStatus: 1 });
unitSchema.index({ societyId: 1, status: 1 });

module.exports = mongoose.model('Unit', unitSchema);
