const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('../src/config/db');

const User = require('../src/models/User');
const Society = require('../src/models/Society');
const SocietySettings = require('../src/models/SocietySettings');
const Building = require('../src/models/Building');
const Unit = require('../src/models/Unit');
const Resident = require('../src/models/Resident');
const FamilyMember = require('../src/models/FamilyMember');
const ServiceRequest = require('../src/models/ServiceRequest');
const EmergencyAlert = require('../src/models/EmergencyAlert');
const Notification = require('../src/models/Notification');
const Visitor = require('../src/models/Visitor');
const VehicleLog = require('../src/models/VehicleLog');
const Delivery = require('../src/models/Delivery');
const DeliveryEntry = require('../src/models/DeliveryEntry');
const Staff = require('../src/models/Staff');
const StaffEntryLog = require('../src/models/StaffEntryLog');
const StaffOTP = require('../src/models/StaffOTP');
const MaintenanceBill = require('../src/models/MaintenanceBill');
const MaintenanceProfile = require('../src/models/MaintenanceProfile');
const Poll = require('../src/models/Poll');
const Notice = require('../src/models/Notice');
const Alert = require('../src/models/Alert');
const Announcement = require('../src/models/Announcement');
const LostItem = require('../src/models/LostItem');
const Amenity = require('../src/models/Amenity');
const AmenityBooking = require('../src/models/AmenityBooking');
const ResidentActivity = require('../src/models/ResidentActivity');
const UserActivity = require('../src/models/UserActivity');
const UserInvite = require('../src/models/UserInvite');
const AuditLog = require('../src/models/AuditLog');
const BoardMember = require('../src/models/BoardMember');
const BlacklistVisitor = require('../src/models/BlacklistVisitor');
const WatchlistVisitor = require('../src/models/WatchlistVisitor');
const SocietyDocument = require('../src/models/SocietyDocument');
const { ROLES } = require('../src/constants/roles');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

function toCount(result) {
  if (!result) return 0;
  return Number(result.deletedCount || result.modifiedCount || result.matchedCount || 0);
}

async function findOrCreatePrimaryAdmin() {
  const targetEmail = String(process.env.RESET_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@societyos.com')
    .trim()
    .toLowerCase();
  const targetPassword = String(process.env.RESET_ADMIN_PASSWORD || 'Admin@123');
  const targetName = String(process.env.RESET_ADMIN_NAME || 'Super Admin');

  let admin = await User.findOne({ email: targetEmail, isDeleted: { $ne: true } });
  if (!admin) {
    admin = await User.findOne({
      role: { $in: [ROLES.ADMIN, ROLES.SUPER_ADMIN] },
      isDeleted: { $ne: true },
    });
  }

  if (!admin) {
    admin = new User({
      name: targetName,
      email: targetEmail,
      password: targetPassword,
      role: ROLES.ADMIN,
      status: 'Active',
      isActive: true,
      isDeleted: false,
      mustChangePassword: false,
    });
    await admin.save();
    return admin;
  }

  admin.name = targetName;
  admin.email = targetEmail;
  admin.password = targetPassword;
  admin.role = ROLES.ADMIN;
  admin.status = 'Active';
  admin.isActive = true;
  admin.isDeleted = false;
  admin.mustChangePassword = false;
  admin.onboardingStatus = 'Completed';
  admin.onboardingWorkflow = {
    profileCreated: true,
    unitAssigned: false,
    activated: true,
  };
  admin.resetPasswordToken = null;
  admin.resetPasswordExpires = null;
  await admin.save();
  return admin;
}

async function findOrCreatePrimarySociety(adminId) {
  const societyName = String(process.env.RESET_SOCIETY_NAME || 'Default Society').trim() || 'Default Society';
  const contactEmail = String(process.env.RESET_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@societyos.com')
    .trim()
    .toLowerCase();

  let society = await Society.findOne({ isDeleted: { $ne: true } }).sort({ createdAt: 1 });
  if (!society) {
    society = await Society.create({
      name: societyName,
      legalName: societyName,
      contactEmail,
      status: 'Active',
      createdBy: adminId,
      isDeleted: false,
    });
  }
  return society;
}

async function run() {
  await connectDB();

  const admin = await findOrCreatePrimaryAdmin();
  const society = await findOrCreatePrimarySociety(admin._id);

  admin.societyId = society._id;
  await admin.save();

  const summary = {};

  // Keep only one society + its settings/docs.
  summary.extraSocietiesDeleted = toCount(
    await Society.deleteMany({ _id: { $ne: society._id } })
  );
  summary.extraSocietySettingsDeleted = toCount(
    await SocietySettings.deleteMany({ societyId: { $ne: society._id } })
  );
  summary.extraSocietyDocumentsDeleted = toCount(
    await SocietyDocument.deleteMany({ societyId: { $ne: society._id } })
  );

  // Remove all non-admin users first.
  summary.nonAdminUsersDeleted = toCount(
    await User.deleteMany({ _id: { $ne: admin._id } })
  );

  // Clear operational data collections.
  const deletions = await Promise.all([
    Resident.deleteMany({}),
    Building.deleteMany({}),
    Unit.deleteMany({}),
    FamilyMember.deleteMany({}),
    ServiceRequest.deleteMany({}),
    EmergencyAlert.deleteMany({}),
    Notification.deleteMany({}),
    Visitor.deleteMany({}),
    VehicleLog.deleteMany({}),
    Delivery.deleteMany({}),
    DeliveryEntry.deleteMany({}),
    Staff.deleteMany({}),
    StaffEntryLog.deleteMany({}),
    StaffOTP.deleteMany({}),
    MaintenanceBill.deleteMany({}),
    MaintenanceProfile.deleteMany({}),
    Poll.deleteMany({}),
    Notice.deleteMany({}),
    Alert.deleteMany({}),
    Announcement.deleteMany({}),
    LostItem.deleteMany({}),
    AmenityBooking.deleteMany({}),
    Amenity.deleteMany({}),
    ResidentActivity.deleteMany({}),
    UserActivity.deleteMany({}),
    UserInvite.deleteMany({}),
    AuditLog.deleteMany({}),
    BoardMember.deleteMany({}),
    BlacklistVisitor.deleteMany({}),
    WatchlistVisitor.deleteMany({}),
  ]);

  [
    'residents',
    'buildings',
    'units',
    'familyMembers',
    'serviceRequests',
    'emergencyAlerts',
    'notifications',
    'visitors',
    'vehicleLogs',
    'deliveries',
    'deliveryEntries',
    'staff',
    'staffEntryLogs',
    'staffOtps',
    'maintenanceBills',
    'maintenanceProfiles',
    'polls',
    'notices',
    'alerts',
    'announcements',
    'lostItems',
    'amenityBookings',
    'amenities',
    'residentActivities',
    'userActivities',
    'userInvites',
    'auditLogs',
    'boardMembers',
    'blacklist',
    'watchlist',
  ].forEach((key, idx) => {
    summary[key] = toCount(deletions[idx]);
  });

  console.log('========================================');
  console.log('QA RESET COMPLETE (single-society mode)');
  console.log('========================================');
  console.log(`Admin email: ${admin.email}`);
  console.log(`Admin role : ${admin.role}`);
  console.log(`Society ID : ${String(society._id)}`);
  console.log('----------------------------------------');
  Object.entries(summary).forEach(([key, value]) => {
    console.log(`${key}: ${value}`);
  });
  console.log('----------------------------------------');
  console.log('Database is now ready for manual end-to-end QA.');
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('QA reset failed:', error?.message || error);
    process.exit(1);
  });

