const dotenv = require('dotenv');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const { ROLES } = require('../src/constants/roles');

dotenv.config();

const DEFAULT_USERS = [
  {
    name: 'Super Admin',
    email: 'admin@societyos.com',
    password: 'Admin@123',
    role: ROLES.ADMIN,
  },
  {
    name: 'Rahul Sharma',
    email: 'tenant@societyos.com',
    password: 'Tenant@123',
    role: ROLES.TENANT,
  },
  {
    name: 'Priya Verma',
    email: 'committee@societyos.com',
    password: 'Committee@123',
    role: ROLES.COMMITTEE,
  },
  {
    name: 'Ramesh Guard',
    email: 'guard@societyos.com',
    password: 'Guard@123',
    role: ROLES.GUARD,
  },
];

async function upsertDefaultUser(userData) {
  const email = userData.email.toLowerCase();
  let user = await User.findOne({ email });

  if (!user) {
    user = new User({ ...userData, email, isActive: true });
  } else {
    user.name = userData.name;
    user.role = userData.role;
    user.password = userData.password;
    user.isActive = true;
  }

  await user.save();
  return user;
}

async function seedUsers() {
  await connectDB();

  for (const payload of DEFAULT_USERS) {
    const user = await upsertDefaultUser(payload);
    console.log(`Seeded: ${user.email} (${user.role})`);
  }

  console.log('Default role-based users seeded successfully.');
  process.exit(0);
}

seedUsers().catch((error) => {
  console.error('Failed to seed default users:', error.message);
  process.exit(1);
});
