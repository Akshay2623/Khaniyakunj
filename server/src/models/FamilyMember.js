const mongoose = require('mongoose');

function resolveAgeCategory(age) {
  const value = Number(age || 0);
  if (value <= 12) return 'Child';
  if (value <= 18) return 'Teen';
  if (value <= 59) return 'Adult';
  return 'Senior Citizen';
}

const familyMemberSchema = new mongoose.Schema(
  {
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Society', required: true, index: true },
    residentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    flatId: { type: String, required: true, trim: true, index: true },
    flatNumber: { type: String, required: true, trim: true, index: true },
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', default: null, index: true },
    name: { type: String, required: true, trim: true },
    age: { type: Number, required: true, min: 0, max: 130 },
    gender: { type: String, required: true, enum: ['Male', 'Female', 'Other'] },
    relation: {
      type: String,
      required: true,
      enum: ['Father', 'Mother', 'Son', 'Daughter', 'Grandfather', 'Grandmother', 'Relative', 'Spouse', 'Sibling', 'Other'],
    },
    phone: { type: String, trim: true, default: '' },
    ageCategory: { type: String, enum: ['Child', 'Teen', 'Adult', 'Senior Citizen'], required: true, index: true },
    createdByResident: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

familyMemberSchema.pre('validate', function assignAgeCategory(next) {
  this.ageCategory = resolveAgeCategory(this.age);
  next();
});

familyMemberSchema.index({ societyId: 1, flatId: 1, createdAt: -1 });

module.exports = mongoose.model('FamilyMember', familyMemberSchema);
