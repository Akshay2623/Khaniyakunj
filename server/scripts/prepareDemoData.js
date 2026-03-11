const path = require('path');
const dotenv = require('dotenv');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const Society = require('../src/models/Society');
const Amenity = require('../src/models/Amenity');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DEFAULT_AMENITIES = [
  {
    name: 'Swimming Pool',
    description: 'Temperature-controlled pool for residents.',
    location: 'Club House Level 1',
    capacity: 25,
    pricePerHour: 300,
    openingTime: '06:00',
    closingTime: '22:00',
    bookingRequired: true,
    approvalRequired: false,
    isActive: true,
  },
  {
    name: 'Community Hall',
    description: 'Spacious hall for events and gatherings.',
    location: 'Community Block',
    capacity: 120,
    pricePerHour: 1200,
    openingTime: '08:00',
    closingTime: '23:00',
    bookingRequired: true,
    approvalRequired: true,
    isActive: true,
  },
  {
    name: 'Gym',
    description: 'Modern fitness center with cardio and strength equipment.',
    location: 'Wellness Wing',
    capacity: 30,
    pricePerHour: 150,
    openingTime: '05:00',
    closingTime: '23:00',
    bookingRequired: true,
    approvalRequired: false,
    isActive: true,
  },
  {
    name: 'Garden',
    description: 'Open landscaped garden for family time and small events.',
    location: 'Central Courtyard',
    capacity: 60,
    pricePerHour: 200,
    openingTime: '06:00',
    closingTime: '21:00',
    bookingRequired: true,
    approvalRequired: false,
    isActive: true,
  },
];

async function run() {
  await connectDB();

  const societies = await Society.find({ isDeleted: { $ne: true } }).sort({ createdAt: 1 });
  if (!societies.length) {
    throw new Error('No active societies found.');
  }

  const defaultSociety = societies[0];
  const fallbackSociety = societies[1] || societies[0];

  const adminUser =
    (await User.findOne({ role: { $in: ['admin', 'super_admin'] }, isDeleted: { $ne: true } }).sort({ createdAt: 1 })) ||
    (await User.findOne({ isDeleted: { $ne: true } }).sort({ createdAt: 1 }));

  if (!adminUser) {
    throw new Error('No user found to use as amenity createdBy.');
  }

  const scopedRoles = ['committee', 'tenant', 'guard'];
  const unmappedUsers = await User.find({
    role: { $in: scopedRoles },
    isDeleted: { $ne: true },
    $or: [{ societyId: null }, { societyId: { $exists: false } }],
  });

  for (const user of unmappedUsers) {
    user.societyId = fallbackSociety._id;
    user.status = 'Active';
    user.isActive = true;
    await user.save();
  }

  await User.updateMany(
    { role: { $in: scopedRoles }, isDeleted: { $ne: true } },
    { $set: { status: 'Active', isActive: true } }
  );

  for (const society of societies) {
    for (const amenity of DEFAULT_AMENITIES) {
      await Amenity.updateOne(
        { societyId: society._id, name: amenity.name, isDeleted: { $ne: true } },
        { $setOnInsert: { ...amenity, societyId: society._id, createdBy: adminUser._id } },
        { upsert: true }
      );
    }
  }

  const summary = [];
  for (const society of societies) {
    const count = await Amenity.countDocuments({ societyId: society._id, isDeleted: { $ne: true } });
    summary.push({ society: society.name, amenities: count });
  }

  console.log('Demo data prepared successfully.');
  console.log(`Unmapped users fixed: ${unmappedUsers.length}`);
  summary.forEach((item) => console.log(`- ${item.society}: ${item.amenities} amenities`));
  process.exit(0);
}

run().catch((error) => {
  console.error('Demo data preparation failed:', error.message);
  process.exit(1);
});
