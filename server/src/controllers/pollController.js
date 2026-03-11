const Poll = require('../models/Poll');
const Society = require('../models/Society');

function isSingleSocietyMode() {
  // Product is currently deployed as single-society.
  // Keep poll data shared across all mapped users regardless of legacy societyId drift.
  return true;
}

function isCreatorRole(role) {
  const normalized = String(role || '').toLowerCase();
  return ['admin', 'super_admin'].includes(normalized);
}

function normalizeOptions(rawOptions = []) {
  return (Array.isArray(rawOptions) ? rawOptions : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 8);
}

async function resolveSocietyId(req, explicitSocietyId = null) {
  if (isSingleSocietyMode()) {
    const activeSingle = await Society.findOne({
      isDeleted: { $ne: true },
      status: { $in: ['Active', 'active'] },
    })
      .sort({ createdAt: 1 })
      .select('_id');
    if (activeSingle?._id) return activeSingle._id;

    const anySingle = await Society.findOne({ isDeleted: { $ne: true } })
      .sort({ createdAt: 1 })
      .select('_id');
    return anySingle?._id || null;
  }

  if (req.user?.societyId) return req.user.societyId;
  if (explicitSocietyId) return explicitSocietyId;

  let fallback = await Society.findOne({
    isDeleted: { $ne: true },
    status: { $in: ['Active', 'active'] },
  })
    .sort({ createdAt: 1 })
    .select('_id');

  if (!fallback) {
    fallback = await Society.findOne({ isDeleted: { $ne: true } })
      .sort({ createdAt: 1 })
      .select('_id');
  }
  return fallback?._id || null;
}

async function getSingleSocietyId() {
  const rows = await Society.find({ isDeleted: { $ne: true } })
    .sort({ createdAt: 1 })
    .select('_id')
    .limit(2);
  return rows.length === 1 ? rows[0]._id : null;
}

function formatPollForUser(poll, userId) {
  const currentUserId = String(userId || '');
  const totalVotes = poll.options.reduce((sum, option) => sum + (option.voteCount || 0), 0);
  const options = poll.options.map((option) => {
    const hasVoted = option.voters.some((id) => String(id) === currentUserId);
    const percentage = totalVotes ? Number(((option.voteCount || 0) * 100 / totalVotes).toFixed(1)) : 0;
    return {
      _id: option._id,
      text: option.text,
      voteCount: option.voteCount || 0,
      percentage,
      hasVoted,
    };
  });
  const userVoted = options.some((option) => option.hasVoted);
  const now = Date.now();
  const opensAt = poll.startAt || null;
  const closesAt = poll.endAt || poll.expiresAt || null;
  const startTs = opensAt ? new Date(opensAt).getTime() : null;
  const endTs = closesAt ? new Date(closesAt).getTime() : null;
  const hasStarted = !startTs || startTs <= now;
  const isExpired = !!endTs && endTs < now;
  const isOpenNow = poll.status === 'ACTIVE' && hasStarted && !isExpired;
  return {
    _id: poll._id,
    title: poll.title,
    description: poll.description,
    status: poll.status,
    expiresAt: poll.expiresAt,
    createdAt: poll.createdAt,
    createdBy: poll.createdBy,
    totalVotes,
    userVoted,
    startAt: opensAt,
    endAt: closesAt,
    isOpenNow,
    options,
  };
}

async function createPoll(req, res) {
  try {
    if (!isCreatorRole(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only admin can create poll.', data: null });
    }
    const societyId = await resolveSocietyId(req, req.body.societyId || null);
    if (!societyId) {
      return res.status(400).json({ success: false, message: 'societyId is required.', data: null });
    }

    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    const options = normalizeOptions(req.body.options);
    const startAt = req.body.startAt ? new Date(req.body.startAt) : null;
    const endAt = req.body.endAt ? new Date(req.body.endAt) : (req.body.expiresAt ? new Date(req.body.expiresAt) : null);

    if (!title) {
      return res.status(400).json({ success: false, message: 'Poll title is required.', data: null });
    }
    if (options.length < 2) {
      return res.status(400).json({ success: false, message: 'At least two poll options are required.', data: null });
    }
    if (startAt && Number.isNaN(startAt.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid poll start date.', data: null });
    }
    if (endAt && Number.isNaN(endAt.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid poll end date.', data: null });
    }
    if (startAt && endAt && endAt <= startAt) {
      return res.status(400).json({ success: false, message: 'Poll end time must be later than start time.', data: null });
    }

    const poll = await Poll.create({
      societyId,
      title,
      description,
      options: options.map((text) => ({ text, voteCount: 0, voters: [] })),
      startAt,
      endAt,
      expiresAt: endAt || null,
      createdBy: req.user._id,
    });

    return res.status(201).json({ success: true, message: 'Poll created successfully.', data: poll });
  } catch {
    return res.status(400).json({ success: false, message: 'Failed to create poll.', data: null });
  }
}

async function getPolls(req, res) {
  try {
    if (isSingleSocietyMode()) {
      const now = new Date();
      await Poll.updateMany(
        {
          status: 'ACTIVE',
          $or: [{ endAt: { $ne: null, $lt: now } }, { endAt: null, expiresAt: { $ne: null, $lt: now } }],
        },
        { $set: { status: 'CLOSED', closedAt: now } }
      );

      const rows = await Poll.find({})
        .populate('createdBy', 'name role')
        .sort({ createdAt: -1 })
        .limit(100);
      const data = rows.map((row) => formatPollForUser(row, req.user._id));
      return res.status(200).json({ success: true, message: 'Polls fetched.', data });
    }

    const societyId = await resolveSocietyId(req, req.query.societyId || null);
    if (!societyId) {
      return res.status(200).json({ success: true, message: 'No society mapping found.', data: [] });
    }
    const now = new Date();
    await Poll.updateMany(
      {
        societyId,
        status: 'ACTIVE',
        $or: [{ endAt: { $ne: null, $lt: now } }, { endAt: null, expiresAt: { $ne: null, $lt: now } }],
      },
      { $set: { status: 'CLOSED', closedAt: now } }
    );

    let rows = await Poll.find({ societyId })
      .populate('createdBy', 'name role')
      .sort({ createdAt: -1 })
      .limit(100);

    // Single-society fallback: if mapped society has no polls, but only one active society exists,
    // read that society's polls to avoid panel mismatch in one-society deployments.
    if (!rows.length) {
      const activeSocieties = await Society.find({
        isDeleted: { $ne: true },
        status: { $in: ['Active', 'active'] },
      })
        .select('_id')
        .limit(2);
      if (activeSocieties.length === 1) {
        rows = await Poll.find({ societyId: activeSocieties[0]._id })
          .populate('createdBy', 'name role')
          .sort({ createdAt: -1 })
          .limit(100);
      }
    }

    if (!rows.length) {
      const singleSocietyId = await getSingleSocietyId();
      if (singleSocietyId) {
        rows = await Poll.find({ societyId: singleSocietyId })
          .populate('createdBy', 'name role')
          .sort({ createdAt: -1 })
          .limit(100);
      }
    }

    if (!rows.length && isSingleSocietyMode()) {
      rows = await Poll.find({})
        .populate('createdBy', 'name role')
        .sort({ createdAt: -1 })
        .limit(100);
    }

    const data = rows.map((row) => formatPollForUser(row, req.user._id));
    return res.status(200).json({ success: true, message: 'Polls fetched.', data });
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to fetch polls.', data: null });
  }
}

async function votePoll(req, res) {
  try {
    const { id } = req.params;
    const optionId = String(req.body.optionId || '').trim();
    if (!optionId) {
      return res.status(400).json({ success: false, message: 'optionId is required.', data: null });
    }

    let poll = null;
    if (isSingleSocietyMode()) {
      poll = await Poll.findById(id);
    } else {
      const societyId = await resolveSocietyId(
        req,
        req.body?.societyId || req.query?.societyId || null
      );
      if (!societyId) {
        return res.status(400).json({ success: false, message: 'societyId is required.', data: null });
      }
      poll = await Poll.findOne({ _id: id, societyId });
      if (!poll) {
        const singleSocietyId = await getSingleSocietyId();
        if (singleSocietyId) {
          poll = await Poll.findOne({ _id: id });
        }
      }
    }
    if (!poll) {
      return res.status(404).json({ success: false, message: 'Poll not found.', data: null });
    }

    if (poll.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'Poll is closed.', data: null });
    }
    const nowTs = Date.now();
    const startTs = poll.startAt ? new Date(poll.startAt).getTime() : null;
    const endTs = poll.endAt ? new Date(poll.endAt).getTime() : (poll.expiresAt ? new Date(poll.expiresAt).getTime() : null);
    if (startTs && startTs > nowTs) {
      return res.status(400).json({ success: false, message: 'Poll has not started yet.', data: null });
    }
    if (endTs && endTs < nowTs) {
      poll.status = 'CLOSED';
      poll.closedAt = new Date();
      await poll.save();
      return res.status(400).json({ success: false, message: 'Poll has expired and is now closed.', data: null });
    }

    const voterId = String(req.user._id);
    const alreadyVoted = poll.options.some((option) => option.voters.some((idValue) => String(idValue) === voterId));
    if (alreadyVoted) {
      return res.status(400).json({ success: false, message: 'You have already voted in this poll.', data: null });
    }

    const option = poll.options.id(optionId);
    if (!option) {
      return res.status(404).json({ success: false, message: 'Poll option not found.', data: null });
    }

    option.voters.push(req.user._id);
    option.voteCount = (option.voteCount || 0) + 1;
    await poll.save();

    return res.status(200).json({
      success: true,
      message: 'Vote submitted.',
      data: formatPollForUser(poll, req.user._id),
    });
  } catch {
    return res.status(400).json({ success: false, message: 'Failed to submit vote.', data: null });
  }
}

async function closePoll(req, res) {
  try {
    if (!isCreatorRole(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only admin can close poll.', data: null });
    }
    const { id } = req.params;
    let poll = null;
    if (isSingleSocietyMode()) {
      poll = await Poll.findById(id);
    } else {
      const societyId = await resolveSocietyId(
        req,
        req.body?.societyId || req.query?.societyId || null
      );
      poll = await Poll.findOne({ _id: id, societyId });
      if (!poll) {
        const singleSocietyId = await getSingleSocietyId();
        if (singleSocietyId) {
          poll = await Poll.findOne({ _id: id });
        }
      }
    }
    if (!poll) {
      return res.status(404).json({ success: false, message: 'Poll not found.', data: null });
    }
    if (poll.status === 'CLOSED') {
      return res.status(200).json({ success: true, message: 'Poll already closed.', data: formatPollForUser(poll, req.user._id) });
    }
    poll.status = 'CLOSED';
    poll.closedAt = new Date();
    poll.closedBy = req.user._id;
    await poll.save();

    return res.status(200).json({ success: true, message: 'Poll closed.', data: formatPollForUser(poll, req.user._id) });
  } catch {
    return res.status(400).json({ success: false, message: 'Failed to close poll.', data: null });
  }
}

async function deletePoll(req, res) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Poll id is required.', data: null });
    }

    let poll = null;
    if (isSingleSocietyMode()) {
      poll = await Poll.findById(id).populate('createdBy', 'name role');
    } else {
      const societyId = await resolveSocietyId(
        req,
        req.body?.societyId || req.query?.societyId || null
      );
      poll = await Poll.findOne({ _id: id, ...(societyId ? { societyId } : {}) }).populate('createdBy', 'name role');
      if (!poll) {
        const singleSocietyId = await getSingleSocietyId();
        if (singleSocietyId) {
          poll = await Poll.findById(id).populate('createdBy', 'name role');
        }
      }
      if (!poll) {
        poll = await Poll.findById(id).populate('createdBy', 'name role');
      }
    }
    if (!poll) {
      return res.status(404).json({ success: false, message: 'Poll not found.', data: null });
    }

    if (!isCreatorRole(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only admin can delete poll.', data: null });
    }

    await Poll.deleteOne({ _id: poll._id });
    return res.status(200).json({ success: true, message: 'Poll deleted.', data: { _id: poll._id } });
  } catch (error) {
    return res
      .status(400)
      .json({ success: false, message: error?.message || 'Failed to delete poll.', data: null });
  }
}

module.exports = {
  createPoll,
  getPolls,
  votePoll,
  closePoll,
  deletePoll,
};
