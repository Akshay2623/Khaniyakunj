const dotenv = require('dotenv');
const connectDB = require('../src/config/db');
const { ROLES } = require('../src/constants/roles');
const User = require('../src/models/User');
const Society = require('../src/models/Society');
const Resident = require('../src/models/Resident');
const MaintenanceBill = require('../src/models/MaintenanceBill');
const ServiceRequest = require('../src/models/ServiceRequest');
const Notice = require('../src/models/Notice');
const Visitor = require('../src/models/Visitor');

dotenv.config();

const DUMMY_PREFIX = 'DUMMY2026';
const RESIDENT_COUNT = 100;

function monthKey(offset) {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + offset);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function randomFrom(list, index) {
  return list[index % list.length];
}

async function getOrCreateUser({ name, email, role, password, societyId = null }) {
  const normalizedEmail = email.toLowerCase();

  let user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    user = await User.create({
      name,
      email: normalizedEmail,
      password,
      role,
      societyId,
    });
  } else {
    user.name = name;
    user.role = role;
    user.societyId = societyId;
    user.password = password;
    user.isActive = true;
    await user.save();
  }

  return user;
}

async function findPrashansaUser() {
  return User.findOne({
    $or: [{ email: /prashansa/i }, { name: /prashansa/i }],
  });
}

async function seed() {
  await connectDB();

  const superAdmin = await getOrCreateUser({
    name: `${DUMMY_PREFIX} Super Admin`,
    email: 'dummy.superadmin@society.local',
    role: ROLES.SUPER_ADMIN,
    password: 'Admin@123',
  });

  let society = await Society.findOne({ name: `${DUMMY_PREFIX} Central Society` });
  if (!society) {
    society = await Society.create({
      name: `${DUMMY_PREFIX} Central Society`,
      legalName: `${DUMMY_PREFIX} Central Society Association`,
      address: {
        line1: 'Sector 100',
        city: 'Demo City',
        state: 'Rajasthan',
        country: 'India',
        postalCode: '302012',
      },
      totalUnits: 200,
      totalBuildings: 4,
      status: 'Active',
      subscriptionPlan: 'Pro',
      createdBy: superAdmin._id,
    });
  } else {
    await Society.updateOne(
      { _id: society._id },
      {
        $set: {
          address: {
            line1: 'Sector 100',
            city: 'Demo City',
            state: 'Rajasthan',
            country: 'India',
            postalCode: '302012',
          },
          totalUnits: 200,
          totalBuildings: 4,
          status: 'Active',
          subscriptionPlan: 'Pro',
        },
      }
    );
    society = await Society.findById(society._id);
  }

  const societyAdmin = await getOrCreateUser({
    name: `${DUMMY_PREFIX} Society Admin`,
    email: 'dummy.societyadmin@society.local',
    role: ROLES.SOCIETY_ADMIN,
    password: 'Admin@123',
    societyId: society._id,
  });

  const prashansaUser = await findPrashansaUser();
  let effectiveSocietyAdmin = societyAdmin;

  if (prashansaUser) {
    if (prashansaUser.role === ROLES.SOCIETY_ADMIN || prashansaUser.role === ROLES.SUPER_ADMIN) {
      prashansaUser.societyId = society._id;
      await prashansaUser.save();
      effectiveSocietyAdmin = prashansaUser;
    } else {
      console.log(
        `Found user matching prashansa (${prashansaUser.email}) but role is ${prashansaUser.role}; kept dummy admin ownership.`
      );
    }
  }

  const serviceProvider = await getOrCreateUser({
    name: `${DUMMY_PREFIX} Service Provider`,
    email: 'dummy.provider@society.local',
    role: ROLES.SERVICE_PROVIDER,
    password: 'Provider@123',
    societyId: society._id,
  });

  await getOrCreateUser({
    name: `${DUMMY_PREFIX} Security`,
    email: 'dummy.security@society.local',
    role: ROLES.SECURITY,
    password: 'Security@123',
    societyId: society._id,
  });

  const residentUsers = [];
  const residentDocs = [];
  const statuses = ['Paid', 'Unpaid', 'Overdue'];
  const categories = ['Electrician', 'Plumber', 'Lift', 'Water', 'Cleaning', 'Security'];
  const priorities = ['Low', 'Medium', 'High'];
  const blocks = ['A', 'B', 'C', 'D'];

  for (let i = 1; i <= RESIDENT_COUNT; i += 1) {
    const padded = String(i).padStart(3, '0');
    const residentEmail = `dummy.resident${padded}@society.local`;

    const user = await getOrCreateUser({
      name: `${DUMMY_PREFIX} Resident ${padded}`,
      email: residentEmail,
      role: ROLES.RESIDENT,
      password: 'Resident@123',
      societyId: society._id,
    });

    let resident = await Resident.findOne({ email: residentEmail });
    if (!resident) {
      resident = await Resident.create({
        userId: user._id,
        societyId: society._id,
        name: `${DUMMY_PREFIX} Resident ${padded}`,
        email: residentEmail,
        phone: `90000${String(i).padStart(5, '0')}`.slice(0, 10),
        flatNumber: `${randomFrom(blocks, i)}-${String(100 + i)}`,
        block: randomFrom(blocks, i),
        occupancyType: i % 2 === 0 ? 'owner' : 'tenant',
        createdBy: effectiveSocietyAdmin._id,
      });
    } else {
      resident.userId = user._id;
      resident.societyId = society._id;
      resident.createdBy = effectiveSocietyAdmin._id;
      await resident.save();
    }

    user.residentId = resident._id;
    await user.save();

    residentUsers.push(user);
    residentDocs.push(resident);
  }

  await ServiceRequest.deleteMany({ title: { $regex: `^${DUMMY_PREFIX}-REQ-` } });
  await Notice.deleteMany({ title: { $regex: `^${DUMMY_PREFIX}-NOTICE-` } });
  await Visitor.deleteMany({ visitorName: { $regex: `^${DUMMY_PREFIX} Visitor ` } });

  const billsBulk = [];
  const serviceRequestBulk = [];
  const notices = [];
  const visitors = [];

  const currentMonth = monthKey(0);
  const monthPool = [monthKey(-5), monthKey(-4), monthKey(-3), monthKey(-2), monthKey(-1), currentMonth];

  for (let i = 0; i < RESIDENT_COUNT; i += 1) {
    const user = residentUsers[i];
    const resident = residentDocs[i];
    const month = randomFrom(monthPool, i);
    const amount = 1200 + (i % 10) * 100;
    const due = new Date();
    due.setDate(5 + (i % 15));
    due.setMonth(due.getMonth() - (i % 2));

    const status = randomFrom(statuses, i);
    const lateFee = status === 'Overdue' ? Number((amount * 0.05).toFixed(2)) : 0;
    const paidAt = status === 'Paid' ? new Date() : null;

    billsBulk.push({
      updateOne: {
        filter: { residentId: user._id, societyId: society._id, month },
        update: {
          $set: {
            residentId: user._id,
            societyId: society._id,
            month,
            amount,
            dueDate: due,
            status,
            paidAt,
            lateFee,
            generatedBy: effectiveSocietyAdmin._id,
          },
        },
        upsert: true,
      },
    });

    serviceRequestBulk.push({
      title: `${DUMMY_PREFIX}-REQ-${String(i + 1).padStart(3, '0')}`,
      description: `Issue raised for flat ${resident.flatNumber}`,
      category: randomFrom(categories, i),
      residentId: user._id,
      societyId: society._id,
      assignedTo: i % 2 === 0 ? serviceProvider._id : null,
      status: i % 3 === 0 ? 'Pending' : i % 3 === 1 ? 'Assigned' : 'Completed',
      priority: randomFrom(priorities, i),
      createdBy: user._id,
      lastUpdatedBy: i % 2 === 0 ? serviceProvider._id : effectiveSocietyAdmin._id,
      completedAt: i % 3 === 2 ? new Date() : null,
    });

    notices.push({
      title: `${DUMMY_PREFIX}-NOTICE-${String(i + 1).padStart(3, '0')}`,
      description: `Notice details for community update #${i + 1}`,
      societyId: society._id,
      createdBy: effectiveSocietyAdmin._id,
      isPinned: i < 10,
      attachments: i % 5 === 0 ? [`https://example.com/notice-${i + 1}.pdf`] : [],
      readBy: i % 2 === 0 ? [{ userId: user._id, readAt: new Date() }] : [],
    });

    const entryTime = new Date();
    entryTime.setHours(9 + (i % 8), i % 60, 0, 0);

    visitors.push({
      visitorName: `${DUMMY_PREFIX} Visitor ${String(i + 1).padStart(3, '0')}`,
      phone: `80000${String(i + 1).padStart(5, '0')}`.slice(0, 10),
      residentId: user._id,
      societyId: society._id,
      status: i % 3 === 0 ? 'Expected' : i % 3 === 1 ? 'Entered' : 'Exited',
      entryTime: i % 3 === 0 ? null : entryTime,
      exitTime: i % 3 === 2 ? new Date(entryTime.getTime() + 60 * 60 * 1000) : null,
      approvedBy: user._id,
    });
  }

  await MaintenanceBill.bulkWrite(billsBulk, { ordered: false });
  await ServiceRequest.insertMany(serviceRequestBulk, { ordered: false });
  await Notice.insertMany(notices, { ordered: false });
  await Visitor.insertMany(visitors, { ordered: false });

  const [residentCount, billCount, requestCount, noticeCount, visitorCount] = await Promise.all([
    Resident.countDocuments({ societyId: society._id, name: { $regex: `^${DUMMY_PREFIX} Resident` } }),
    MaintenanceBill.countDocuments({ societyId: society._id }),
    ServiceRequest.countDocuments({ societyId: society._id, title: { $regex: `^${DUMMY_PREFIX}-REQ-` } }),
    Notice.countDocuments({ societyId: society._id, title: { $regex: `^${DUMMY_PREFIX}-NOTICE-` } }),
    Visitor.countDocuments({ societyId: society._id, visitorName: { $regex: `^${DUMMY_PREFIX} Visitor` } }),
  ]);

  console.log('Seed completed.');
  console.log(`Society: ${society.name}`);
  console.log(`Residents: ${residentCount}`);
  console.log(`Bills: ${billCount}`);
  console.log(`ServiceRequests: ${requestCount}`);
  console.log(`Notices: ${noticeCount}`);
  console.log(`Visitors: ${visitorCount}`);
  if (prashansaUser && String(effectiveSocietyAdmin._id) === String(prashansaUser._id)) {
    console.log(`Linked account to dummy society: ${prashansaUser.email}`);
  }
  console.log('Login credentials:');
  console.log('- admin: dummy.superadmin@society.local / Admin@123');
  console.log('- admin: dummy.societyadmin@society.local / Admin@123');
  console.log('- committee: dummy.provider@society.local / Provider@123');
  console.log('- guard: dummy.security@society.local / Security@123');
  console.log('- tenants: dummy.resident001@society.local .. dummy.resident100@society.local / Resident@123');

  process.exit(0);
}

seed().catch((error) => {
  console.error('Seed failed:', error.message);
  process.exit(1);
});
