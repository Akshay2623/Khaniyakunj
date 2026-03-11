const mongoose = require('mongoose');
const Amenity = require('../models/Amenity');
const AmenityBooking = require('../models/AmenityBooking');
const Unit = require('../models/Unit');
const Society = require('../models/Society');
const { ROLES, normalizeRole } = require('../constants/roles');

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

function toMinutes(time) {
  const [h, m] = String(time).split(':').map(Number);
  return h * 60 + m;
}

function normalizeDateOnly(input) {
  const source = new Date(input);
  if (Number.isNaN(source.getTime())) {
    const err = new Error('Invalid date.');
    err.statusCode = 400;
    throw err;
  }
  return new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth(), source.getUTCDate()));
}

function sameSociety(a, b) {
  return String(a) === String(b);
}

async function resolveSocietyId({ actor, requestedSocietyId = null, required = true }) {
  const role = normalizeRole(actor.role);
  const actorSocietyId = actor.societyId || null;
  const defaultSocietyPromise = Society.findOne({ isDeleted: { $ne: true }, status: 'Active' }).select('_id');

  if (role !== ROLES.ADMIN && role !== ROLES.SUPER_ADMIN) {
    if (!actorSocietyId && requestedSocietyId) {
      return requestedSocietyId;
    }
    if (!actorSocietyId) {
      const defaultSociety = await defaultSocietyPromise;
      if (defaultSociety) return defaultSociety._id;
      const err = new Error('User is not mapped to a society. Select a society to continue.');
      err.statusCode = 400;
      throw err;
    }
    if (requestedSocietyId && !sameSociety(actorSocietyId, requestedSocietyId)) {
      const err = new Error('Forbidden: invalid society scope.');
      err.statusCode = 403;
      throw err;
    }
    return actorSocietyId;
  }

  if (actorSocietyId) {
    if (requestedSocietyId && !sameSociety(actorSocietyId, requestedSocietyId)) {
      const err = new Error('Forbidden: invalid society scope.');
      err.statusCode = 403;
      throw err;
    }
    return actorSocietyId;
  }

  if (requestedSocietyId) return requestedSocietyId;
  const defaultSociety = await defaultSocietyPromise;
  if (defaultSociety) return defaultSociety._id;
  if (!required) return null;

  const err = new Error('societyId is required.');
  err.statusCode = 400;
  throw err;
}

async function ensureSocietyExists(societyId) {
  const society = await Society.findOne({ _id: societyId, isDeleted: { $ne: true } });
  if (!society) {
    const err = new Error('Society not found.');
    err.statusCode = 404;
    throw err;
  }
}

function checkOperatingWindow({ amenity, startTime, endTime }) {
  const open = toMinutes(amenity.openingTime);
  const close = toMinutes(amenity.closingTime);
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);

  if (start >= end) {
    const err = new Error('endTime must be later than startTime.');
    err.statusCode = 400;
    throw err;
  }

  if (start < open || end > close) {
    const err = new Error(`Booking must be within operating hours (${amenity.openingTime} - ${amenity.closingTime}).`);
    err.statusCode = 400;
    throw err;
  }
}

function isOverlapping(slotA, slotB) {
  const aStart = toMinutes(slotA.startTime);
  const aEnd = toMinutes(slotA.endTime);
  const bStart = toMinutes(slotB.startTime);
  const bEnd = toMinutes(slotB.endTime);
  return aStart < bEnd && bStart < aEnd;
}

async function ensureNoOverlap({ amenityId, societyId, bookingDate, startTime, endTime, excludeBookingId = null }) {
  const filter = {
    amenityId,
    societyId,
    bookingDate,
    bookingStatus: { $in: ['Pending', 'Approved', 'Completed'] },
  };
  if (excludeBookingId) {
    filter._id = { $ne: excludeBookingId };
  }

  const bookings = await AmenityBooking.find(filter).select('startTime endTime');
  const hasOverlap = bookings.some((booking) => isOverlapping({ startTime, endTime }, booking));
  if (hasOverlap) {
    const err = new Error('Selected time slot is already booked.');
    err.statusCode = 409;
    throw err;
  }
}

async function createAmenity({ actor, payload }) {
  const societyId = await resolveSocietyId({ actor, requestedSocietyId: payload.societyId });
  await ensureSocietyExists(societyId);

  const open = toMinutes(payload.openingTime);
  const close = toMinutes(payload.closingTime);
  if (open >= close) {
    const err = new Error('closingTime must be later than openingTime.');
    err.statusCode = 400;
    throw err;
  }

  try {
    return await Amenity.create({
      ...payload,
      societyId,
      createdBy: actor._id,
    });
  } catch (error) {
    if (error.code === 11000) {
      const err = new Error('Amenity name already exists in this society.');
      err.statusCode = 409;
      throw err;
    }
    throw error;
  }
}

async function listAmenities({ actor, query }) {
  const societyId = await resolveSocietyId({ actor, requestedSocietyId: query.societyId });
  const filter = { societyId, isDeleted: { $ne: true } };
  if (query.isActive === 'true') filter.isActive = true;
  let amenities = await Amenity.find(filter).sort({ createdAt: -1 });

  if (!amenities.length) {
    const seedDocs = DEFAULT_AMENITIES.map((amenity) => ({
      ...amenity,
      societyId,
      createdBy: actor._id,
    }));
    await Amenity.insertMany(seedDocs, { ordered: false }).catch(() => {});
    amenities = await Amenity.find(filter).sort({ createdAt: -1 });
  }

  return amenities;
}

async function updateAmenity({ actor, amenityId, payload }) {
  const amenity = await Amenity.findOne({ _id: amenityId, isDeleted: { $ne: true } });
  if (!amenity) {
    const err = new Error('Amenity not found.');
    err.statusCode = 404;
    throw err;
  }

  const societyId = await resolveSocietyId({ actor, requestedSocietyId: amenity.societyId });
  if (!sameSociety(societyId, amenity.societyId)) {
    const err = new Error('Forbidden.');
    err.statusCode = 403;
    throw err;
  }

  const nextOpening = payload.openingTime || amenity.openingTime;
  const nextClosing = payload.closingTime || amenity.closingTime;
  if (toMinutes(nextOpening) >= toMinutes(nextClosing)) {
    const err = new Error('closingTime must be later than openingTime.');
    err.statusCode = 400;
    throw err;
  }

  Object.assign(amenity, payload);
  await amenity.save();
  return amenity;
}

async function deleteAmenity({ actor, amenityId }) {
  const amenity = await Amenity.findOne({ _id: amenityId, isDeleted: { $ne: true } });
  if (!amenity) {
    const err = new Error('Amenity not found.');
    err.statusCode = 404;
    throw err;
  }
  const societyId = await resolveSocietyId({ actor, requestedSocietyId: amenity.societyId });
  if (!sameSociety(societyId, amenity.societyId)) {
    const err = new Error('Forbidden.');
    err.statusCode = 403;
    throw err;
  }

  amenity.isDeleted = true;
  amenity.isActive = false;
  await amenity.save();
  return { id: amenity._id };
}

async function createAmenityBooking({ actor, payload }) {
  const role = normalizeRole(actor.role);
  if (![ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.COMMITTEE, ROLES.TENANT, ROLES.OWNER, ROLES.RESIDENT].includes(role)) {
    const err = new Error('Forbidden: this role cannot book amenities.');
    err.statusCode = 403;
    throw err;
  }

  const amenity = await Amenity.findOne({ _id: payload.amenityId, isDeleted: { $ne: true } });
  if (!amenity || !amenity.isActive) {
    const err = new Error('Amenity is not available.');
    err.statusCode = 404;
    throw err;
  }

  const societyId = await resolveSocietyId({ actor, requestedSocietyId: payload.societyId || amenity.societyId });
  if (!sameSociety(societyId, amenity.societyId)) {
    const err = new Error('Forbidden: amenity belongs to another society.');
    err.statusCode = 403;
    throw err;
  }

  if (!amenity.bookingRequired) {
    const err = new Error('Booking is not required for this amenity.');
    err.statusCode = 400;
    throw err;
  }

  const bookingDate = normalizeDateOnly(payload.bookingDate);
  checkOperatingWindow({ amenity, startTime: payload.startTime, endTime: payload.endTime });
  await ensureNoOverlap({
    amenityId: amenity._id,
    societyId,
    bookingDate,
    startTime: payload.startTime,
    endTime: payload.endTime,
  });

  let unitId = payload.unitId || actor.unitId || null;
  if (unitId) {
    const unit = await Unit.findOne({ _id: unitId, societyId, isDeleted: { $ne: true } });
    if (!unit) {
      const err = new Error('Unit not found in this society.');
      err.statusCode = 400;
      throw err;
    }
    unitId = unit._id;
  }

  const isAdminBooking = role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN;
  const bookingStatus = isAdminBooking ? 'Approved' : (amenity.approvalRequired ? 'Pending' : 'Approved');
  return AmenityBooking.create({
    amenityId: amenity._id,
    userId: actor._id,
    unitId,
    societyId,
    bookingDate,
    startTime: payload.startTime,
    endTime: payload.endTime,
    totalGuests: payload.totalGuests || 1,
    specialRequest: payload.specialRequest || '',
    bookingStatus,
    approvedBy: bookingStatus === 'Approved' ? actor._id : null,
    approvedAt: bookingStatus === 'Approved' ? new Date() : null,
  });
}

function buildBookingFilterForRole({ actor, query = {}, mode = 'general' }) {
  const role = normalizeRole(actor.role);
  const filter = {};

  if (actor.societyId) {
    filter.societyId = actor.societyId;
  } else if (query.societyId && (role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN)) {
    filter.societyId = query.societyId;
  }

  if (query.bookingDate) {
    filter.bookingDate = normalizeDateOnly(query.bookingDate);
  }
  if (query.amenityId) filter.amenityId = query.amenityId;
  if (query.status) filter.bookingStatus = query.status;

  if (mode === 'mine') {
    filter.userId = actor._id;
  }
  if (mode === 'today') {
    filter.bookingDate = normalizeDateOnly(new Date());
  }

  return filter;
}

async function listBookings({ actor, query, mode = 'general' }) {
  const filter = buildBookingFilterForRole({ actor, query, mode });
  const bookings = await AmenityBooking.find(filter)
    .populate('amenityId', 'name location openingTime closingTime')
    .populate('userId', 'name email phone role')
    .populate('unitId', 'unitNumber')
    .sort({ bookingDate: -1, startTime: 1 });

  return bookings;
}

async function updateBookingStatus({ actor, bookingId, status }) {
  const booking = await AmenityBooking.findById(bookingId);
  if (!booking) {
    const err = new Error('Booking not found.');
    err.statusCode = 404;
    throw err;
  }

  const societyId = await resolveSocietyId({ actor, requestedSocietyId: booking.societyId });
  if (!sameSociety(societyId, booking.societyId)) {
    const err = new Error('Forbidden.');
    err.statusCode = 403;
    throw err;
  }

  booking.bookingStatus = status;
  if (status === 'Approved') {
    booking.approvedBy = actor._id;
    booking.approvedAt = new Date();
    booking.rejectedBy = null;
    booking.rejectedAt = null;
  }
  if (status === 'Rejected') {
    booking.rejectedBy = actor._id;
    booking.rejectedAt = new Date();
    booking.approvedBy = null;
    booking.approvedAt = null;
  }
  await booking.save();
  return booking;
}

async function getAmenityAvailability({ actor, query }) {
  const societyId = await resolveSocietyId({ actor, requestedSocietyId: query.societyId });
  const bookingDate = normalizeDateOnly(query.bookingDate);
  const amenity = await Amenity.findOne({
    _id: query.amenityId,
    societyId,
    isDeleted: { $ne: true },
    isActive: true,
  });
  if (!amenity) {
    const err = new Error('Amenity not found.');
    err.statusCode = 404;
    throw err;
  }

  const bookings = await AmenityBooking.find({
    amenityId: amenity._id,
    societyId,
    bookingDate,
    bookingStatus: { $in: ['Pending', 'Approved', 'Completed'] },
  }).select('startTime endTime bookingStatus');

  const open = toMinutes(amenity.openingTime);
  const close = toMinutes(amenity.closingTime);
  const slots = [];

  for (let cursor = open; cursor + 30 <= close; cursor += 30) {
    const slotStart = `${String(Math.floor(cursor / 60)).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}`;
    const slotEndMinutes = cursor + 30;
    const slotEnd = `${String(Math.floor(slotEndMinutes / 60)).padStart(2, '0')}:${String(slotEndMinutes % 60).padStart(2, '0')}`;
    const isBooked = bookings.some((booking) => isOverlapping({ startTime: slotStart, endTime: slotEnd }, booking));
    slots.push({ startTime: slotStart, endTime: slotEnd, isAvailable: !isBooked });
  }

  return {
    amenityId: amenity._id,
    amenityName: amenity.name,
    bookingDate,
    openingTime: amenity.openingTime,
    closingTime: amenity.closingTime,
    slots,
  };
}

async function getCalendarData({ actor, query }) {
  const role = normalizeRole(actor.role);
  const societyId = await resolveSocietyId({
    actor,
    requestedSocietyId: query.societyId,
    required: role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN ? false : true,
  });

  const from = query.from ? normalizeDateOnly(query.from) : normalizeDateOnly(new Date(new Date().setDate(1)));
  const to = query.to
    ? normalizeDateOnly(query.to)
    : normalizeDateOnly(new Date(new Date(from).setDate(new Date(from).getDate() + 60)));

  const filter = {
    bookingDate: { $gte: from, $lte: to },
  };
  if (societyId) filter.societyId = societyId;
  if (role === ROLES.TENANT || role === ROLES.OWNER) {
    filter.userId = actor._id;
  }

  const bookings = await AmenityBooking.find(filter)
    .populate('amenityId', 'name')
    .sort({ bookingDate: 1, startTime: 1 });

  return bookings.map((booking) => ({
    date: booking.bookingDate,
    startTime: booking.startTime,
    endTime: booking.endTime,
    amenityName: booking.amenityId?.name || 'Amenity',
    bookingStatus: booking.bookingStatus,
    bookingId: booking._id,
  }));
}

async function getAmenityAnalytics({ actor, query }) {
  const societyId = await resolveSocietyId({
    actor,
    requestedSocietyId: query.societyId,
  });

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const today = normalizeDateOnly(now);

  const [totalBookingsThisMonth, mostBookedAgg, upcomingBookingsRaw, revenueAgg] = await Promise.all([
    AmenityBooking.countDocuments({
      societyId,
      bookingDate: { $gte: monthStart, $lt: nextMonthStart },
    }),
    AmenityBooking.aggregate([
      { $match: { societyId } },
      { $group: { _id: '$amenityId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
      {
        $lookup: {
          from: 'amenities',
          localField: '_id',
          foreignField: '_id',
          as: 'amenity',
        },
      },
      { $unwind: '$amenity' },
      { $project: { _id: 0, amenityId: '$amenity._id', amenityName: '$amenity.name', count: 1 } },
    ]),
    AmenityBooking.find({
      societyId,
      bookingDate: { $gte: today },
      bookingStatus: { $in: ['Pending', 'Approved'] },
    })
      .populate('amenityId', 'name')
      .populate('userId', 'name')
      .sort({ bookingDate: 1, startTime: 1 })
      .limit(10),
    AmenityBooking.aggregate([
      {
        $match: {
          societyId: new mongoose.Types.ObjectId(societyId),
          bookingDate: { $gte: monthStart, $lt: nextMonthStart },
          bookingStatus: { $in: ['Approved', 'Completed'] },
        },
      },
      {
        $lookup: {
          from: 'amenities',
          localField: 'amenityId',
          foreignField: '_id',
          as: 'amenity',
        },
      },
      { $unwind: '$amenity' },
      {
        $project: {
          hours: {
            $divide: [
              {
                $subtract: [
                  {
                    $add: [
                      { $multiply: [{ $toInt: { $substr: ['$endTime', 0, 2] } }, 60] },
                      { $toInt: { $substr: ['$endTime', 3, 2] } },
                    ],
                  },
                  {
                    $add: [
                      { $multiply: [{ $toInt: { $substr: ['$startTime', 0, 2] } }, 60] },
                      { $toInt: { $substr: ['$startTime', 3, 2] } },
                    ],
                  },
                ],
              },
              60,
            ],
          },
          pricePerHour: '$amenity.pricePerHour',
        },
      },
      {
        $group: {
          _id: null,
          revenueFromBookings: { $sum: { $multiply: ['$hours', '$pricePerHour'] } },
        },
      },
      { $project: { _id: 0, revenueFromBookings: 1 } },
    ]),
  ]);

  return {
    totalBookingsThisMonth,
    mostBookedAmenity: mostBookedAgg[0] || null,
    upcomingBookings: upcomingBookingsRaw.map((booking) => ({
      id: booking._id,
      date: booking.bookingDate,
      startTime: booking.startTime,
      endTime: booking.endTime,
      bookingStatus: booking.bookingStatus,
      amenityName: booking.amenityId?.name || 'Amenity',
      bookedBy: booking.userId?.name || 'User',
    })),
    revenueFromBookings: Number((revenueAgg[0]?.revenueFromBookings || 0).toFixed(2)),
  };
}

module.exports = {
  createAmenity,
  listAmenities,
  updateAmenity,
  deleteAmenity,
  createAmenityBooking,
  listBookings,
  updateBookingStatus,
  getAmenityAvailability,
  getCalendarData,
  getAmenityAnalytics,
};
