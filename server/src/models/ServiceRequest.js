const mongoose = require('mongoose');

const serviceRequestSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    imageUrl: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      required: true,
      enum: ['Electrician', 'Plumber', 'Lift', 'Water', 'Cleaning', 'Security'],
    },
    preferredVisitTime: {
      type: Date,
      default: null,
    },
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
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assignedRole: {
      type: String,
      enum: ['guard', 'committee', 'admin'],
      default: 'guard',
      index: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'InProgress', 'Resolved', 'Assigned', 'Completed'],
      default: 'Pending',
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
    },
    completedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    createdByRole: {
      type: String,
      trim: true,
      default: 'tenant',
      index: true,
    },
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    statusTimeline: {
      type: [
        new mongoose.Schema(
          {
            status: {
              type: String,
              enum: ['Submitted', 'Assigned', 'InProgress', 'Completed'],
              required: true,
            },
            changedAt: {
              type: Date,
              default: Date.now,
            },
            changedBy: {
              type: mongoose.Schema.Types.ObjectId,
              ref: 'User',
              default: null,
            },
            note: {
              type: String,
              trim: true,
              default: '',
            },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

serviceRequestSchema.index({ societyId: 1, status: 1, category: 1 });
serviceRequestSchema.index({ residentId: 1, createdAt: -1 });
serviceRequestSchema.index({ societyId: 1, createdAt: -1 });
serviceRequestSchema.index({ societyId: 1, category: 1 });

const ServiceRequest = mongoose.model('ServiceRequest', serviceRequestSchema);

module.exports = ServiceRequest;
