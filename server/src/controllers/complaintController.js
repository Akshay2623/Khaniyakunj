const ServiceRequest = require('../models/ServiceRequest');
const Resident = require('../models/Resident');

async function raiseComplaint(req, res) {
  try {
    const { title, description } = req.body;

    if (!title || !description) {
      return res.status(400).json({ message: 'Title and description are required.' });
    }

    const resident = await Resident.findOne({ userId: req.user._id });
    if (!resident) {
      return res.status(404).json({ message: 'Resident profile not found.' });
    }

    const request = await ServiceRequest.create({
      societyId: resident.societyId,
      residentId: resident._id,
      title,
      description,
      createdBy: req.user._id,
      lastUpdatedBy: req.user._id,
    });

    return res.status(201).json(request);
  } catch (error) {
    return res.status(400).json({ message: 'Failed to raise complaint.' });
  }
}

async function getMyComplaints(req, res) {
  try {
    const resident = await Resident.findOne({ userId: req.user._id });
    if (!resident) {
      return res.status(404).json({ message: 'Resident profile not found.' });
    }

    const complaints = await ServiceRequest.find({ residentId: resident._id }).sort({ createdAt: -1 });
    return res.status(200).json(complaints);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch complaints.' });
  }
}

module.exports = {
  raiseComplaint,
  getMyComplaints,
};