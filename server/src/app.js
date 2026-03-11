const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const societyRoutes = require('./routes/societyRoutes');
const residentRoutes = require('./routes/residentRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const serviceRequestRoutes = require('./routes/serviceRequestRoutes');
const noticeRoutes = require('./routes/noticeRoutes');
const visitorRoutes = require('./routes/visitorRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const userRoutes = require('./routes/userRoutes');
const buildingRoutes = require('./routes/buildingRoutes');
const unitRoutes = require('./routes/unitRoutes');
const securityRoutes = require('./routes/securityRoutes');
const amenityRoutes = require('./routes/amenityRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const lostItemRoutes = require('./routes/lostItemRoutes');
const domesticStaffRoutes = require('./routes/domesticStaffRoutes');
const aiAssistantRoutes = require('./routes/aiAssistantRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const alertRoutes = require('./routes/alertRoutes');
const familyMemberRoutes = require('./routes/familyMemberRoutes');
const pollRoutes = require('./routes/pollRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/societies', societyRoutes);
app.use('/api/v1/societies', societyRoutes);
app.use('/api/residents', residentRoutes);
app.use('/api/resident', residentRoutes);
app.use('/api/admin/residents', residentRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/bills', maintenanceRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/service-requests', serviceRequestRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/visitors', visitorRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/buildings', buildingRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/amenities', amenityRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/lost-items', lostItemRoutes);
app.use('/api/domestic-staff', domesticStaffRoutes);
app.use('/api/ai-assistant', aiAssistantRoutes);
app.use('/api', announcementRoutes);
app.use('/api', alertRoutes);
app.use('/api/family-members', familyMemberRoutes);
app.use('/api/polls', pollRoutes);

// Fallback frontend hosting for environments where Vite dev server is unavailable.
const clientDistPath = path.resolve(__dirname, '../../client/dist');
const clientIndexPath = path.join(clientDistPath, 'index.html');
if (fs.existsSync(clientIndexPath)) {
  app.use(express.static(clientDistPath));
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(clientIndexPath);
  });
}

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.', data: null });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const statusCode = error.statusCode || 500;
  return res.status(statusCode).json({ success: false, message: error.message || 'Internal server error.', data: null });
});

module.exports = app;
