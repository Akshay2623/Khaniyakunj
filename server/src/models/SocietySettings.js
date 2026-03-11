const mongoose = require('mongoose');

const societySettingsSchema = new mongoose.Schema(
  {
    societyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Society',
      required: true,
      unique: true,
      index: true,
    },
    maintenanceBillingDay: { type: Number, min: 1, max: 28, default: 1 },
    lateFeePercentage: { type: Number, min: 0, max: 100, default: 5 },
    gracePeriodDays: { type: Number, min: 0, default: 0 },
    allowPartialPayments: { type: Boolean, default: false },
    enableVisitorManagement: { type: Boolean, default: true },
    enableAmenityBooking: { type: Boolean, default: false },
    enableOnlinePayments: { type: Boolean, default: true },
    enableVotingModule: { type: Boolean, default: false },
    languagePreference: { type: String, trim: true, default: 'en-US' },
    dateFormat: { type: String, trim: true, default: 'YYYY-MM-DD' },
    timeFormat: { type: String, trim: true, default: '24h' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SocietySettings', societySettingsSchema);
