const express = require('express');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { ROLES } = require('../constants/roles');
const {
  visitorEntry,
  visitorExit,
  todayVisitors,
  allVisitors,
  visitorReport,
  myVisitors,
  vehicleEntry,
  vehicleExit,
  vehicleLogs,
  packageReceived,
  packageDelivered,
  receivedPackagesForGuard,
  myPackages,
  allPackages,
  emergencyAlert,
  emergencyAlerts,
  resolveEmergencyAlert,
  myEmergencyAlerts,
  dailyReport,
  listBlacklist,
  addBlacklist,
  deleteBlacklist,
  listWatchlist,
  addWatchlist,
  deleteWatchlist,
  guardUnits,
  guardResidents,
  deliveryResidentLookup,
  sendDeliveryOtp,
  verifyDeliveryOtp,
  allowDeliveryEntry,
  deliveryExit,
  guardDeliveryHistory,
} = require('../controllers/securityController');

const router = express.Router();

// Visitor entry system
router.post('/visitor-entry', protect, authorizeRoles(ROLES.GUARD), visitorEntry);
router.post('/visitor-exit', protect, authorizeRoles(ROLES.GUARD), visitorExit);
router.get('/today-visitors', protect, authorizeRoles(ROLES.GUARD), todayVisitors);
router.get('/guard-units', protect, authorizeRoles(ROLES.GUARD), guardUnits);
router.get('/guard-residents', protect, authorizeRoles(ROLES.GUARD), guardResidents);
router.get('/all-visitors', protect, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), allVisitors);
router.get('/visitor-report', protect, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), visitorReport);
router.get('/daily-report', protect, authorizeRoles(ROLES.GUARD, ROLES.ADMIN, ROLES.SUPER_ADMIN), dailyReport);
router.get('/my-visitors', protect, authorizeRoles(ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT), myVisitors);

// Vehicle entry log
router.post('/vehicle-entry', protect, authorizeRoles(ROLES.GUARD), vehicleEntry);
router.post('/vehicle-exit', protect, authorizeRoles(ROLES.GUARD), vehicleExit);
router.get('/vehicle-logs', protect, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), vehicleLogs);

// Delivery management
router.post('/package-received', protect, authorizeRoles(ROLES.GUARD), packageReceived);
router.post('/package-delivered', protect, authorizeRoles(ROLES.GUARD), packageDelivered);
router.get('/received-packages', protect, authorizeRoles(ROLES.GUARD), receivedPackagesForGuard);
router.get('/my-packages', protect, authorizeRoles(ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT), myPackages);
router.get('/all-packages', protect, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), allPackages);

// Delivery OTP gate flow
router.get('/deliveries/resident-lookup', protect, authorizeRoles(ROLES.GUARD), deliveryResidentLookup);
router.post('/deliveries/send-otp', protect, authorizeRoles(ROLES.GUARD), sendDeliveryOtp);
router.post('/deliveries/verify-otp', protect, authorizeRoles(ROLES.GUARD), verifyDeliveryOtp);
router.post('/deliveries/allow-entry', protect, authorizeRoles(ROLES.GUARD), allowDeliveryEntry);
router.put('/deliveries/:id/exit', protect, authorizeRoles(ROLES.GUARD), deliveryExit);
router.get('/deliveries/history', protect, authorizeRoles(ROLES.GUARD), guardDeliveryHistory);

// Emergency alerts
router.post('/emergency-alert', protect, emergencyAlert);
router.get('/my-emergency-alerts', protect, myEmergencyAlerts);
router.get('/emergency-alerts', protect, emergencyAlerts);
router.put('/emergency-alert/:id/resolve', protect, resolveEmergencyAlert);

// Blacklist / watchlist admin management
router.get('/blacklist', protect, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), listBlacklist);
router.post('/blacklist', protect, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), addBlacklist);
router.delete('/blacklist/:id', protect, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), deleteBlacklist);
router.get('/watchlist', protect, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), listWatchlist);
router.post('/watchlist', protect, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), addWatchlist);
router.delete('/watchlist/:id', protect, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), deleteWatchlist);

module.exports = router;
