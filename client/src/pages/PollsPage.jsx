import { useEffect, useMemo, useState } from 'react';
import { FiCheckCircle, FiPlusCircle, FiTrash2, FiXCircle } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import AppButton from '../components/ui/AppButton.jsx';
import AppCard from '../components/ui/AppCard.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';

const INITIAL_FORM = {
  title: '',
  description: '',
  optionA: '',
  optionB: '',
  optionC: '',
  optionD: '',
  startAt: '',
  endAt: '',
};

function PollsPage() {
  const { apiRequest, admin } = useAuth();
  const { showToast } = useToast();
  const role = String(admin?.role || '').toLowerCase();
  const canCreate = ['admin', 'super_admin'].includes(role);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [polls, setPolls] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [voteSelections, setVoteSelections] = useState({});
  const [votingPollId, setVotingPollId] = useState('');
  const [confirmDelete, setConfirmDelete] = useState({ open: false, pollId: '' });

  async function loadPolls() {
    const payload = await apiRequest('/api/polls', { raw: true });
    setPolls(payload?.data || []);
  }

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        await loadPolls();
      } catch (err) {
        showToast(err.message || 'Failed to load polls.', 'error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      loadPolls().catch(() => {});
    }, 20000);
    return () => clearInterval(timer);
  }, []);

  const activeCount = useMemo(() => polls.filter((item) => item.status === 'ACTIVE').length, [polls]);

  async function submitPoll(event) {
    event.preventDefault();
    try {
      const title = String(form.title || '').trim();
      if (!title) {
        showToast('Poll title is required.', 'error');
        return;
      }

      if (!form.startAt || !form.endAt) {
        showToast('Poll start and end time are required.', 'error');
        return;
      }
      const startTs = new Date(form.startAt).getTime();
      const endTs = new Date(form.endAt).getTime();
      if (Number.isNaN(startTs) || Number.isNaN(endTs)) {
        showToast('Please provide valid poll start/end date-time.', 'error');
        return;
      }
      if (endTs <= startTs) {
        showToast('Poll end time must be later than start time.', 'error');
        return;
      }

      setSaving(true);
      const options = [form.optionA, form.optionB, form.optionC, form.optionD].map((item) => item.trim()).filter(Boolean);
      if (options.length < 2) {
        showToast('Please provide at least two poll options.', 'error');
        return;
      }
      await apiRequest('/api/polls', {
        method: 'POST',
        body: {
          title,
          description: form.description.trim(),
          options,
          startAt: form.startAt,
          endAt: form.endAt,
        },
        raw: true,
      });
      showToast('Poll created successfully.', 'success');
      setForm(INITIAL_FORM);
      await loadPolls();
    } catch (err) {
      showToast(err.message || 'Failed to create poll.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function vote(pollId, optionId) {
    try {
      setVotingPollId(String(pollId));
      await apiRequest(`/api/polls/${pollId}/vote`, {
        method: 'PUT',
        body: { optionId },
        raw: true,
      });
      showToast('Vote submitted.', 'success');
      setVoteSelections((prev) => ({ ...prev, [String(pollId)]: '' }));
      await loadPolls();
    } catch (err) {
      showToast(err.message || 'Failed to vote.', 'error');
    } finally {
      setVotingPollId('');
    }
  }

  async function closePoll(pollId) {
    try {
      await apiRequest(`/api/polls/${pollId}/close`, { method: 'PUT', raw: true });
      showToast('Poll closed.', 'success');
      await loadPolls();
    } catch (err) {
      showToast(err.message || 'Failed to close poll.', 'error');
    }
  }

  async function deletePoll(pollId) {
    try {
      await apiRequest(`/api/polls/${pollId}`, { method: 'DELETE', raw: true });
      showToast('Poll deleted.', 'success');
      try {
        await loadPolls();
      } catch {
        // Keep success state if deletion succeeded but refresh fails transiently.
      }
    } catch (err) {
      showToast(err.message || 'Failed to delete poll.', 'error');
    }
  }

  if (loading) {
    return <AppCard className="text-sm text-slate-600 dark:text-slate-300">Loading polls...</AppCard>;
  }

  return (
    <div className="app-fade-up space-y-4">
      <section className="saas-card rounded-2xl border border-violet-200/70 bg-gradient-to-r from-violet-50 via-white to-cyan-50 p-4 dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-700 dark:text-violet-300">Community Polling</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">Society Opinion Board</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Active polls: <span className="font-semibold">{activeCount}</span>
        </p>
      </section>

      {canCreate ? (
        <AppCard className="p-3">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Create Poll</h3>
          <form onSubmit={submitPoll} className="mt-2 grid gap-2 md:grid-cols-2">
            <input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Poll title" className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
            <input value={form.startAt} onChange={(e) => setForm((prev) => ({ ...prev, startAt: e.target.value }))} type="datetime-local" className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
            <input value={form.endAt} onChange={(e) => setForm((prev) => ({ ...prev, endAt: e.target.value }))} type="datetime-local" className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
            <textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Poll description (optional)" className="md:col-span-2 min-h-20 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
            <input value={form.optionA} onChange={(e) => setForm((prev) => ({ ...prev, optionA: e.target.value }))} placeholder="Option 1" className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
            <input value={form.optionB} onChange={(e) => setForm((prev) => ({ ...prev, optionB: e.target.value }))} placeholder="Option 2" className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
            <input value={form.optionC} onChange={(e) => setForm((prev) => ({ ...prev, optionC: e.target.value }))} placeholder="Option 3 (optional)" className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
            <input value={form.optionD} onChange={(e) => setForm((prev) => ({ ...prev, optionD: e.target.value }))} placeholder="Option 4 (optional)" className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
            <AppButton type="submit" disabled={saving} className="md:col-span-2 md:w-fit">
              <FiPlusCircle size={14} />
              {saving ? 'Creating...' : 'Create Poll'}
            </AppButton>
          </form>
        </AppCard>
      ) : null}

      <section className="space-y-2">
        {polls.map((poll) => (
          <AppCard key={poll._id} as="article" className="rounded-xl p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">{poll.title}</h3>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{poll.description || 'No description'}</p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Votes: {poll.totalVotes} | Status: {poll.status}
                </p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Window: {poll.startAt ? new Date(poll.startAt).toLocaleString() : '-'} to {poll.endAt ? new Date(poll.endAt).toLocaleString() : '-'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {canCreate && poll.status === 'ACTIVE' ? (
                  <AppButton type="button" variant="danger" onClick={() => closePoll(poll._id)} className="px-2 py-1 text-[11px]">
                    <FiXCircle size={12} />
                    Close Poll
                  </AppButton>
                ) : null}
                {canCreate ? (
                  <AppButton type="button" variant="secondary" onClick={() => setConfirmDelete({ open: true, pollId: poll._id })} className="px-2 py-1 text-[11px]">
                    <FiTrash2 size={12} />
                    Delete Poll
                  </AppButton>
                ) : null}
              </div>
            </div>
            <div className="mt-2 space-y-1.5">
              {poll.options.map((option) => (
                <label key={option._id} className="block rounded-lg border border-slate-200 p-2 text-xs transition hover:border-cyan-200 hover:bg-cyan-50/40 dark:border-slate-700 dark:hover:border-slate-500 dark:hover:bg-slate-800/50">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {poll.status === 'ACTIVE' && poll.isOpenNow && !poll.userVoted ? (
                        <input
                          type="radio"
                          name={`poll-${poll._id}`}
                          checked={String(voteSelections[poll._id] || '') === String(option._id)}
                          onChange={() => setVoteSelections((prev) => ({ ...prev, [poll._id]: option._id }))}
                          className="h-3.5 w-3.5"
                        />
                      ) : null}
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-100">{option.text}</p>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {option.voteCount} votes ({option.percentage}%)
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-1.5 rounded-full bg-cyan-500" style={{ width: `${Math.min(option.percentage || 0, 100)}%` }} />
                  </div>
                  {option.hasVoted ? <p className="mt-1 text-[11px] font-semibold text-emerald-600">Your vote</p> : null}
                </label>
              ))}
              {poll.status === 'ACTIVE' && poll.isOpenNow && !poll.userVoted ? (
                <AppButton
                  type="button"
                  disabled={!voteSelections[poll._id] || votingPollId === String(poll._id)}
                  onClick={() => vote(poll._id, voteSelections[poll._id])}
                  className="mt-1 px-3 py-1 text-xs"
                >
                  <FiCheckCircle size={12} />
                  {votingPollId === String(poll._id) ? 'Submitting...' : 'Submit Vote'}
                </AppButton>
              ) : null}
              {poll.status === 'ACTIVE' && !poll.isOpenNow ? (
                <p className="mt-1 text-[11px] font-medium text-amber-600">
                  {poll.startAt && new Date(poll.startAt).getTime() > Date.now()
                    ? `Voting starts at ${new Date(poll.startAt).toLocaleString()}`
                    : 'Voting window is closed.'}
                </p>
              ) : null}
            </div>
          </AppCard>
        ))}
        {!polls.length ? <EmptyState message="No polls created yet." /> : null}
      </section>

      <ConfirmModal
        open={confirmDelete.open}
        title="Delete Poll"
        description="Are you sure you want to delete this poll? This action cannot be undone."
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete({ open: false, pollId: '' })}
        onConfirm={async () => {
          const pollId = confirmDelete.pollId;
          setConfirmDelete({ open: false, pollId: '' });
          if (!pollId) return;
          await deletePoll(pollId);
        }}
      />
    </div>
  );
}

export default PollsPage;
