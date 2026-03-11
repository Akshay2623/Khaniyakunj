const mongoose = require('mongoose');

const maintenanceBillSchema = new mongoose.Schema(
  {
    residentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    societyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Society',
      required: true,
      index: true,
    },
    month: {
      type: String,
      required: true,
      trim: true,
      match: [/^\d{4}-(0[1-9]|1[0-2])$/, 'month must be in YYYY-MM format'],
    },
    billingYear: {
      type: Number,
      default: null,
      index: true,
    },
    billingMonth: {
      type: Number,
      default: null,
      index: true,
    },
    flatNumber: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    residentName: {
      type: String,
      trim: true,
      default: '',
    },
    residentEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['Paid', 'Unpaid', 'Overdue'],
      default: 'Unpaid',
    },
    paidAt: {
      type: Date,
      default: null,
    },
    paymentMethod: {
      type: String,
      enum: ['Card', 'UPI', 'BankTransfer', 'Cash', 'Online', 'Unknown'],
      default: null,
    },
    lateFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

maintenanceBillSchema.index({ residentId: 1, societyId: 1, month: 1 }, { unique: true });
maintenanceBillSchema.index({ societyId: 1, month: 1, flatNumber: 1 });
maintenanceBillSchema.index({ societyId: 1, month: 1 });
maintenanceBillSchema.index({ societyId: 1, status: 1, dueDate: 1 });
maintenanceBillSchema.index({ societyId: 1, status: 1, paidAt: 1 });
maintenanceBillSchema.index({ residentId: 1, month: 1, status: 1 });
maintenanceBillSchema.index({ residentId: 1, paidAt: -1 });

maintenanceBillSchema.pre('validate', function syncBillingParts(next) {
  if (typeof this.month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(this.month)) {
    const [year, month] = this.month.split('-').map((value) => Number(value));
    this.billingYear = year;
    this.billingMonth = month;
  }
  next();
});

const MaintenanceBill = mongoose.model('MaintenanceBill', maintenanceBillSchema);

module.exports = MaintenanceBill;
