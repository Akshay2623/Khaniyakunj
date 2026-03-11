const mongoose = require('mongoose');

const residentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      unique: true,
      sparse: true,
    },
    societyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Society',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    flatNumber: {
      type: String,
      required: true,
      trim: true,
    },
    block: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    occupancyType: {
      type: String,
      required: true,
      enum: ['owner', 'tenant'],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    dndEnabled: {
      type: Boolean,
      default: false,
      index: true,
    },
    dndExpiryTime: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

residentSchema.index({ societyId: 1, flatNumber: 1 }, { unique: true });
residentSchema.index({ name: 1 });
residentSchema.index({ flatNumber: 1 });

const Resident = mongoose.model('Resident', residentSchema);

module.exports = Resident;
