const FamilyMember = require('../models/FamilyMember');
const Unit = require('../models/Unit');
const Resident = require('../models/Resident');
const Society = require('../models/Society');
const mongoose = require('mongoose');
const { resolveSingleSocietyId, ensureUserSocietyMapping } = require('../services/singleSocietyService');

function normalizePhone(phone) {
  return String(phone || '').replace(/\s+/g, '').trim();
}

function buildAgeSummary(rows = []) {
  const summary = {
    totalMembers: 0,
    children: 0,
    teens: 0,
    adults: 0,
    seniorCitizens: 0,
  };
  rows.forEach((row) => {
    summary.totalMembers += 1;
    const category = String(row?.ageCategory || '').toLowerCase();
    if (category === 'child') summary.children += 1;
    else if (category === 'teen') summary.teens += 1;
    else if (category === 'adult') summary.adults += 1;
    else if (category === 'senior citizen') summary.seniorCitizens += 1;
  });
  return summary;
}

async function resolveResidentFlatContext(user) {
  const societyId = await resolveSingleSocietyId({ user });
  if (!societyId) return null;
  try {
    await ensureUserSocietyMapping(user);
  } catch {
    // Non-fatal for family-member operations; continue with fallback context.
  }
  const fallback = {
    societyId,
    residentId: user._id,
    flatId: `user:${user._id}`,
    unitId: null,
    flatNumber: 'UNASSIGNED',
  };

  try {
    if (user.unitId) {
      const byUserUnit = await Unit.findOne({ _id: user.unitId, societyId, isDeleted: { $ne: true } }).select('unitNumber');
      if (byUserUnit) {
        return {
          societyId,
          residentId: user._id,
          flatId: String(user.unitId),
          unitId: user.unitId,
          flatNumber: byUserUnit.unitNumber,
        };
      }
    }

    const linkedUnit = await Unit.findOne({
      societyId,
      isDeleted: { $ne: true },
      $or: [{ tenantId: user._id }, { ownerId: user._id }],
    }).select('_id unitNumber');
    if (linkedUnit) {
      return {
        societyId,
        residentId: user._id,
        flatId: String(linkedUnit._id),
        unitId: linkedUnit._id,
        flatNumber: linkedUnit.unitNumber,
      };
    }

    const residentRecord = await Resident.findOne({ userId: user._id, societyId }).select('_id flatNumber');
    if (residentRecord?.flatNumber) {
      return {
        societyId,
        residentId: user._id,
        flatId: `resident:${residentRecord._id}`,
        unitId: null,
        flatNumber: residentRecord.flatNumber,
      };
    }

    // Backward compatibility: many legacy tenant/resident users are created without unitId mapping.
    // Resolve by resident master email/phone/name where possible.
    const fallbackResidentByEmail = user.email
      ? await Resident.findOne({
          societyId,
          email: String(user.email).trim().toLowerCase(),
        }).select('_id flatNumber userId')
      : null;
    if (fallbackResidentByEmail?.flatNumber) {
      return {
        societyId,
        residentId: user._id,
        flatId: `resident:${fallbackResidentByEmail._id}`,
        unitId: null,
        flatNumber: fallbackResidentByEmail.flatNumber,
      };
    }

    const fallbackResidentByPhone = user.phone
      ? await Resident.findOne({
          societyId,
          phone: normalizePhone(user.phone),
        }).select('_id flatNumber userId')
      : null;
    if (fallbackResidentByPhone?.flatNumber) {
      return {
        societyId,
        residentId: user._id,
        flatId: `resident:${fallbackResidentByPhone._id}`,
        unitId: null,
        flatNumber: fallbackResidentByPhone.flatNumber,
      };
    }

    const fallbackResidentByName = user.name
      ? await Resident.findOne({
          societyId,
          name: String(user.name).trim(),
        }).select('_id flatNumber userId')
      : null;
    if (fallbackResidentByName?.flatNumber) {
      return {
        societyId,
        residentId: user._id,
        flatId: `resident:${fallbackResidentByName._id}`,
        unitId: null,
        flatNumber: fallbackResidentByName.flatNumber,
      };
    }
  } catch {
    return fallback;
  }

  // Final single-society fallback to avoid runtime break:
  // preserve ownership isolation using residentId filter while allowing member CRUD.
  return fallback;
}

async function ensureWritableSocietyId(context, user) {
  if (context?.societyId && mongoose.Types.ObjectId.isValid(String(context.societyId))) {
    return context.societyId;
  }
  const resolved = await resolveSingleSocietyId({ user, requestedSocietyId: context?.societyId || null });
  if (resolved && mongoose.Types.ObjectId.isValid(String(resolved))) return resolved;
  const firstSociety = await Society.findOne({ isDeleted: { $ne: true } }).sort({ createdAt: 1 }).select('_id');
  return firstSociety?._id || null;
}

function sanitizeMemberInput(body = {}) {
  return {
    name: String(body.name || '').trim(),
    age: Number(body.age),
    gender: String(body.gender || '').trim(),
    relation: String(body.relation || '').trim(),
    phone: normalizePhone(body.phone),
  };
}

function validateMemberInput(input) {
  if (!input.name) return 'Full name is required.';
  if (!Number.isFinite(input.age) || input.age < 0 || input.age > 130) return 'Age must be between 0 and 130.';
  if (!['Male', 'Female', 'Other'].includes(input.gender)) return 'Gender must be Male, Female, or Other.';
  const relations = new Set(['Father', 'Mother', 'Son', 'Daughter', 'Grandfather', 'Grandmother', 'Relative', 'Spouse', 'Sibling', 'Other']);
  if (!relations.has(input.relation)) return 'Relation is invalid.';
  return '';
}

async function getMyFamilyMembers(req, res) {
  try {
    const context = await resolveResidentFlatContext(req.user);
    if (!context) {
      return res.status(400).json({ success: false, message: 'Unable to resolve resident flat mapping.', data: null });
    }

    const rows = await FamilyMember.find({
      societyId: context.societyId,
      flatId: context.flatId,
      residentId: req.user._id,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'Family members fetched.',
      data: {
        flat: {
          flatId: context.flatId,
          flatNumber: context.flatNumber,
        },
        members: rows,
        summary: buildAgeSummary(rows),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error?.message || 'Failed to fetch family members.', data: null });
  }
}

async function addMyFamilyMember(req, res) {
  try {
    const context = await resolveResidentFlatContext(req.user);
    if (!context) {
      return res.status(400).json({ success: false, message: 'Unable to resolve resident flat mapping.', data: null });
    }

    const input = sanitizeMemberInput(req.body);
    const error = validateMemberInput(input);
    if (error) {
      return res.status(400).json({ success: false, message: error, data: null });
    }

    const writableSocietyId = await ensureWritableSocietyId(context, req.user);
    if (!writableSocietyId) {
      return res.status(400).json({ success: false, message: 'Society mapping is missing for this user.', data: null });
    }

    const member = await FamilyMember.create({
      ...input,
      societyId: writableSocietyId,
      residentId: req.user._id,
      flatId: String(context.flatId || `user:${req.user._id}`),
      flatNumber: String(context.flatNumber || 'UNASSIGNED'),
      unitId: context.unitId,
      createdByResident: req.user._id,
    });

    return res.status(201).json({ success: true, message: 'Family member added.', data: member });
  } catch (error) {
    return res.status(400).json({ success: false, message: error?.message || 'Failed to add family member.', data: null });
  }
}

async function updateMyFamilyMember(req, res) {
  try {
    const context = await resolveResidentFlatContext(req.user);
    if (!context) {
      return res.status(400).json({ success: false, message: 'Unable to resolve resident flat mapping.', data: null });
    }

    const { id } = req.params;
    const member = await FamilyMember.findOne({
      _id: id,
      societyId: context.societyId,
      flatId: context.flatId,
      residentId: req.user._id,
    });
    if (!member) {
      return res.status(404).json({ success: false, message: 'Family member not found.', data: null });
    }

    const input = sanitizeMemberInput(req.body);
    const error = validateMemberInput(input);
    if (error) {
      return res.status(400).json({ success: false, message: error, data: null });
    }

    member.name = input.name;
    member.age = input.age;
    member.gender = input.gender;
    member.relation = input.relation;
    member.phone = input.phone;
    await member.save();

    return res.status(200).json({ success: true, message: 'Family member updated.', data: member });
  } catch (error) {
    return res.status(400).json({ success: false, message: error?.message || 'Failed to update family member.', data: null });
  }
}

async function deleteMyFamilyMember(req, res) {
  try {
    const context = await resolveResidentFlatContext(req.user);
    if (!context) {
      return res.status(400).json({ success: false, message: 'Unable to resolve resident flat mapping.', data: null });
    }

    const { id } = req.params;
    const deleted = await FamilyMember.findOneAndDelete({
      _id: id,
      societyId: context.societyId,
      flatId: context.flatId,
      residentId: req.user._id,
    });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Family member not found.', data: null });
    }

    return res.status(200).json({ success: true, message: 'Family member deleted.', data: deleted });
  } catch (error) {
    return res.status(400).json({ success: false, message: error?.message || 'Failed to delete family member.', data: null });
  }
}

async function getSocietyFamilySummary(req, res) {
  try {
    const societyId = await resolveSingleSocietyId({ user: req.user, requestedSocietyId: req.query.societyId || null });
    if (!societyId) {
      return res.status(200).json({ success: true, message: 'No society configured.', data: buildAgeSummary([]) });
    }

    const rows = await FamilyMember.find({ societyId }).select('ageCategory');
    const summary = buildAgeSummary(rows);
    return res.status(200).json({ success: true, message: 'Family summary fetched.', data: summary });
  } catch (error) {
    return res.status(500).json({ success: false, message: error?.message || 'Failed to fetch family summary.', data: null });
  }
}

async function getFamilySummaryForCurrentUser(req, res) {
  try {
    const role = String(req.user.role || '').toLowerCase();
    if (['tenant', 'resident', 'owner'].includes(role)) {
      const context = await resolveResidentFlatContext(req.user);
      if (!context) {
        return res.status(200).json({
          success: true,
          message: 'No resident flat mapping found.',
          data: { totalMembers: 0, children: 0, teens: 0, adults: 0, seniorCitizens: 0 },
        });
      }
      const rows = await FamilyMember.find({
        societyId: context.societyId,
        flatId: context.flatId,
        residentId: req.user._id,
      }).select('ageCategory');
      return res.status(200).json({ success: true, message: 'Family summary fetched.', data: buildAgeSummary(rows) });
    }

    return getSocietyFamilySummary(req, res);
  } catch (error) {
    return res.status(500).json({ success: false, message: error?.message || 'Failed to fetch family summary.', data: null });
  }
}

async function getFamilyMembersByFlat(req, res) {
  try {
    const societyId = await resolveSingleSocietyId({ user: req.user, requestedSocietyId: req.query.societyId || null });
    if (!societyId) {
      return res.status(200).json({ success: true, message: 'No society configured.', data: { flatId: req.params.flatId, flatNumber: '', members: [], summary: buildAgeSummary([]) } });
    }
    const { flatId } = req.params;
    if (!flatId) {
      return res.status(400).json({ success: false, message: 'flatId is required.', data: null });
    }

    const rows = await FamilyMember.find({ societyId, flatId })
      .populate('residentId', 'name email phone')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'Flat family members fetched.',
      data: {
        flatId,
        flatNumber: rows[0]?.flatNumber || '',
        members: rows,
        summary: buildAgeSummary(rows),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error?.message || 'Failed to fetch flat family members.', data: null });
  }
}

async function getFamilyFlatsOverview(req, res) {
  try {
    const societyId = await resolveSingleSocietyId({ user: req.user, requestedSocietyId: req.query.societyId || null });
    if (!societyId) {
      return res.status(200).json({ success: true, message: 'No society configured.', data: [] });
    }

    const societyObjectId = mongoose.Types.ObjectId.isValid(String(societyId))
      ? new mongoose.Types.ObjectId(String(societyId))
      : societyId;

    const rows = await FamilyMember.aggregate([
      { $match: { societyId: societyObjectId } },
      {
        $group: {
          _id: '$flatId',
          flatNumber: { $first: '$flatNumber' },
          totalMembers: { $sum: 1 },
          children: {
            $sum: {
              $cond: [{ $eq: ['$ageCategory', 'Child'] }, 1, 0],
            },
          },
          teens: {
            $sum: {
              $cond: [{ $eq: ['$ageCategory', 'Teen'] }, 1, 0],
            },
          },
          adults: {
            $sum: {
              $cond: [{ $eq: ['$ageCategory', 'Adult'] }, 1, 0],
            },
          },
          seniorCitizens: {
            $sum: {
              $cond: [{ $eq: ['$ageCategory', 'Senior Citizen'] }, 1, 0],
            },
          },
        },
      },
      { $sort: { flatNumber: 1 } },
    ]);

    return res.status(200).json({ success: true, message: 'Family flats overview fetched.', data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: error?.message || 'Failed to fetch family flats overview.', data: null });
  }
}

module.exports = {
  getMyFamilyMembers,
  addMyFamilyMember,
  updateMyFamilyMember,
  deleteMyFamilyMember,
  getFamilyFlatsOverview,
  getFamilyMembersByFlat,
  getFamilySummaryForCurrentUser,
};
