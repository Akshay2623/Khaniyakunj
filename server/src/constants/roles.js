const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  OWNER: 'owner',
  TENANT: 'tenant',
  RESIDENT: 'resident',
  COMMITTEE: 'committee',
  GUARD: 'guard',

  // Legacy aliases used in existing modules/controllers.
  SOCIETY_ADMIN: 'admin',
  RESIDENT: 'resident',
  SERVICE_PROVIDER: 'committee',
  SECURITY: 'guard',
};

const ALLOWED_MODULES_BY_ROLE = {
  [ROLES.SUPER_ADMIN]: [
    'dashboard',
    'userManagement',
    'unitManagement',
    'amenities',
    'residents',
    'maintenance',
    'serviceRequests',
    'payments',
    'reports',
    'notices',
    'visitors',
    'lostFound',
    'domesticStaff',
    'familyMembers',
    'polls',
  ],
  [ROLES.ADMIN]: [
    'dashboard',
    'userManagement',
    'unitManagement',
    'amenities',
    'residents',
    'maintenance',
    'serviceRequests',
    'reports',
    'notices',
    'visitors',
    'lostFound',
    'domesticStaff',
    'familyMembers',
    'polls',
  ],
  [ROLES.TENANT]: [
    'dashboard',
    'amenities',
    'serviceRequests',
    'notices',
    'visitors',
    'lostFound',
    'domesticStaff',
    'familyMembers',
    'polls',
  ],
  [ROLES.RESIDENT]: [
    'dashboard',
    'amenities',
    'serviceRequests',
    'notices',
    'visitors',
    'lostFound',
    'domesticStaff',
    'familyMembers',
    'polls',
  ],
  [ROLES.OWNER]: [
    'dashboard',
    'amenities',
    'payments',
    'notices',
    'visitors',
    'lostFound',
    'domesticStaff',
    'familyMembers',
    'polls',
  ],
  [ROLES.COMMITTEE]: [
    'dashboard',
    'amenities',
    'serviceRequests',
    'visitors',
    'reports',
    'maintenance',
    'residents',
    'notices',
    'lostFound',
    'familyMembers',
    'polls',
  ],
  [ROLES.GUARD]: [
    'serviceRequests',
    'visitors',
    'lostFound',
    'domesticStaff',
  ],
};

const LEGACY_ROLE_MAP = {
  society_admin: ROLES.ADMIN,
  service_provider: ROLES.COMMITTEE,
  security: ROLES.GUARD,
  security_guard: ROLES.GUARD,
  securityguard: ROLES.GUARD,
  guard_user: ROLES.GUARD,
  committee_member: ROLES.COMMITTEE,
  committee_members: ROLES.COMMITTEE,
  admins: ROLES.ADMIN,
  residents: ROLES.RESIDENT,
  tenants: ROLES.TENANT,
  owners: ROLES.OWNER,
  committees: ROLES.COMMITTEE,
  guards: ROLES.GUARD,
};

function normalizeRole(role) {
  if (!role) return role;
  const normalized = String(role).trim().toLowerCase().replace(/[\s-]+/g, '_');
  const mapped = LEGACY_ROLE_MAP[normalized] || normalized;
  if (mapped.includes('guard') || mapped === 'security') return ROLES.GUARD;
  if (mapped.includes('committee')) return ROLES.COMMITTEE;
  if (mapped === 'residents') return ROLES.RESIDENT;
  if (mapped === 'tenants') return ROLES.TENANT;
  if (mapped === 'owners') return ROLES.OWNER;
  if (mapped === 'admins') return ROLES.ADMIN;
  if (mapped === 'society_admin') return ROLES.ADMIN;
  return mapped;
}

function getAllowedModulesByRole(role) {
  return ALLOWED_MODULES_BY_ROLE[normalizeRole(role)] || [];
}

function getRoleValues() {
  return [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.OWNER, ROLES.TENANT, ROLES.RESIDENT, ROLES.COMMITTEE, ROLES.GUARD];
}

module.exports = {
  ROLES,
  ALLOWED_MODULES_BY_ROLE,
  getAllowedModulesByRole,
  getRoleValues,
  normalizeRole,
};
