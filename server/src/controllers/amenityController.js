const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');
const {
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
} = require('../services/amenityService');

module.exports = {
  createAmenity: asyncHandler(async (req, res) => {
    const amenity = await createAmenity({ actor: req.user, payload: req.body });
    return successResponse(res, { statusCode: 201, message: 'Amenity created successfully.', data: amenity });
  }),

  getAmenities: asyncHandler(async (req, res) => {
    const amenities = await listAmenities({ actor: req.user, query: req.query });
    return successResponse(res, { message: 'Amenities fetched successfully.', data: amenities });
  }),

  updateAmenity: asyncHandler(async (req, res) => {
    const amenity = await updateAmenity({ actor: req.user, amenityId: req.params.id, payload: req.body });
    return successResponse(res, { message: 'Amenity updated successfully.', data: amenity });
  }),

  deleteAmenity: asyncHandler(async (req, res) => {
    const result = await deleteAmenity({ actor: req.user, amenityId: req.params.id });
    return successResponse(res, { message: 'Amenity deleted successfully.', data: result });
  }),

  bookAmenity: asyncHandler(async (req, res) => {
    const booking = await createAmenityBooking({ actor: req.user, payload: req.body });
    return successResponse(res, {
      statusCode: 201,
      message: booking.bookingStatus === 'Pending' ? 'Booking created and pending approval.' : 'Booking confirmed successfully.',
      data: booking,
    });
  }),

  getMyBookings: asyncHandler(async (req, res) => {
    const bookings = await listBookings({ actor: req.user, query: req.query, mode: 'mine' });
    return successResponse(res, { message: 'My bookings fetched successfully.', data: bookings });
  }),

  getAllBookings: asyncHandler(async (req, res) => {
    const bookings = await listBookings({ actor: req.user, query: req.query, mode: 'general' });
    return successResponse(res, { message: 'All bookings fetched successfully.', data: bookings });
  }),

  getCommitteeBookings: asyncHandler(async (req, res) => {
    const bookings = await listBookings({ actor: req.user, query: req.query, mode: 'general' });
    return successResponse(res, { message: 'Committee bookings fetched successfully.', data: bookings });
  }),

  getTodayBookingsForGuard: asyncHandler(async (req, res) => {
    const bookings = await listBookings({ actor: req.user, query: req.query, mode: 'today' });
    return successResponse(res, { message: 'Today bookings fetched successfully.', data: bookings });
  }),

  approveBooking: asyncHandler(async (req, res) => {
    const booking = await updateBookingStatus({ actor: req.user, bookingId: req.params.bookingId, status: 'Approved' });
    return successResponse(res, { message: 'Booking approved successfully.', data: booking });
  }),

  rejectBooking: asyncHandler(async (req, res) => {
    const booking = await updateBookingStatus({ actor: req.user, bookingId: req.params.bookingId, status: 'Rejected' });
    return successResponse(res, { message: 'Booking rejected successfully.', data: booking });
  }),

  getAvailability: asyncHandler(async (req, res) => {
    const data = await getAmenityAvailability({ actor: req.user, query: req.query });
    return successResponse(res, { message: 'Availability fetched successfully.', data });
  }),

  getCalendar: asyncHandler(async (req, res) => {
    const data = await getCalendarData({ actor: req.user, query: req.query });
    return successResponse(res, { message: 'Calendar data fetched successfully.', data });
  }),

  getAnalytics: asyncHandler(async (req, res) => {
    const data = await getAmenityAnalytics({ actor: req.user, query: req.query });
    return successResponse(res, { message: 'Amenities analytics fetched successfully.', data });
  }),
};

