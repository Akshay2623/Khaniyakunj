const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('../src/config/db');
const Society = require('../src/models/Society');
const User = require('../src/models/User');
const Resident = require('../src/models/Resident');
const MaintenanceBill = require('../src/models/MaintenanceBill');
const ServiceRequest = require('../src/models/ServiceRequest');
const Notice = require('../src/models/Notice');
const Visitor = require('../src/models/Visitor');
const Amenity = require('../src/models/Amenity');
const AmenityBooking = require('../src/models/AmenityBooking');
const Building = require('../src/models/Building');
const Unit = require('../src/models/Unit');
const Delivery = require('../src/models/Delivery');
const EmergencyAlert = require('../src/models/EmergencyAlert');
const VehicleLog = require('../src/models/VehicleLog');
const BlacklistVisitor = require('../src/models/BlacklistVisitor');
const WatchlistVisitor = require('../src/models/WatchlistVisitor');
const ResidentActivity = require('../src/models/ResidentActivity');
const UserActivity = require('../src/models/UserActivity');
const UserInvite = require('../src/models/UserInvite');
const BoardMember = require('../src/models/BoardMember');
const MaintenanceProfile = require('../src/models/MaintenanceProfile');
const SocietySettings = require('../src/models/SocietySettings');
const SocietyDocument = require('../src/models/SocietyDocument');
const AuditLog = require('../src/models/AuditLog');
const Notification = require('../src/models/Notification');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const KEEP_SOCIETY_COUNT = 2;

const SOCIETY_SCOPED_MODELS = [
  Amenity,
  AmenityBooking,
  AuditLog,
  BlacklistVisitor,
  BoardMember,
  Building,
  Delivery,
  EmergencyAlert,
  MaintenanceBill,
  MaintenanceProfile,
  Notice,
  Notification,
  Resident,
  ResidentActivity,
  ServiceRequest,
  SocietyDocument,
  SocietySettings,
  Unit,
  UserActivity,
  UserInvite,
  VehicleLog,
  Visitor,
  WatchlistVisitor,
];

async function removeSeededDummyData() {
  await Promise.all([
    ServiceRequest.deleteMany({ title: { $regex: '^DUMMY2026-REQ-' } }),
    Notice.deleteMany({ title: { $regex: '^DUMMY2026-NOTICE-' } }),
    Visitor.deleteMany({ visitorName: { $regex: '^DUMMY2026 Visitor ' } }),
    Resident.deleteMany({ name: { $regex: '^DUMMY2026 Resident ' } }),
    User.deleteMany({ email: { $regex: '^dummy\\.' } }),
    Society.deleteMany({ name: { $regex: '^DUMMY2026 ' } }),
  ]);
}

async function deleteSocietyScopedData(societyIdsToDelete) {
  if (!societyIdsToDelete.length) return;
  const where = { societyId: { $in: societyIdsToDelete } };

  for (const model of SOCIETY_SCOPED_MODELS) {
    await model.deleteMany(where);
  }
}

async function anonymizeRetainedData(retainedSocieties) {
  for (let i = 0; i < retainedSocieties.length; i += 1) {
    const society = retainedSocieties[i];
    const index = i + 1;
    const nextSocietyName = `Dummy Society ${index}`;
    await Society.updateOne(
      { _id: society._id },
      {
        $set: {
          name: nextSocietyName,
          legalName: `Dummy Society ${index} Association`,
        },
      }
    );

    const users = await User.find({ societyId: society._id }).sort({ createdAt: 1 });
    for (let u = 0; u < users.length; u += 1) {
      const user = users[u];
      await User.updateOne(
        { _id: user._id },
        { $set: { name: `Dummy ${String(user.role || 'user').replace('_', ' ')} ${u + 1}` } }
      );
    }

    const residents = await Resident.find({ societyId: society._id }).sort({ createdAt: 1 });
    for (let r = 0; r < residents.length; r += 1) {
      const resident = residents[r];
      await Resident.updateOne({ _id: resident._id }, { $set: { name: `Dummy Resident ${r + 1}` } });
    }
  }
}

async function run() {
  await connectDB();

  await removeSeededDummyData();

  const activeSocieties = await Society.find({ isDeleted: { $ne: true } }).sort({ createdAt: 1 });
  const retainedSocieties = activeSocieties.slice(0, KEEP_SOCIETY_COUNT);
  const retainedIds = retainedSocieties.map((society) => society._id);
  const deleteIds = activeSocieties
    .filter((society) => !retainedIds.some((keepId) => String(keepId) === String(society._id)))
    .map((society) => society._id);

  await deleteSocietyScopedData(deleteIds);
  if (deleteIds.length) {
    await Society.deleteMany({ _id: { $in: deleteIds } });
  }

  await anonymizeRetainedData(retainedSocieties);

  const finalSocieties = await Society.find({ isDeleted: { $ne: true } }).select('name').sort({ name: 1 });
  console.log('Cleanup complete.');
  console.log(`Retained societies: ${finalSocieties.length}`);
  finalSocieties.forEach((society) => console.log(`- ${society.name}`));
  process.exit(0);
}

run().catch((error) => {
  console.error('Cleanup failed:', error.message);
  process.exit(1);
});
