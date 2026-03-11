import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../contexts/AuthContext.jsx';

function ReportsPage() {
  const { apiRequest } = useAuth();
  const [societies, setSocieties] = useState([]);
  const [reportData, setReportData] = useState([]);
  const [securityReport, setSecurityReport] = useState(null);
  const [vehicleLogs, setVehicleLogs] = useState([]);
  const [allPackages, setAllPackages] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError('');

        const societyData = await apiRequest('/api/societies');
        setSocieties(societyData);

        const residentSets = await Promise.all(
          societyData.map((society) =>
            apiRequest(`/api/residents?societyId=${society._id}`)
              .then((payload) => (Array.isArray(payload) ? payload : payload.data || []))
              .catch(() => [])
          )
        );

        const data = societyData.map((society, index) => {
          const residents = residentSets[index] || [];
          return {
            society: society.name.length > 12 ? `${society.name.slice(0, 12)}...` : society.name,
            flats: society.totalFlats,
            residents: residents.length,
            occupancyRate: society.totalFlats
              ? Number(((residents.length / society.totalFlats) * 100).toFixed(1))
              : 0,
          };
        });

        setReportData(data);

        const [dailyReportPayload, vehiclePayload, packagePayload, alertPayload] = await Promise.all([
          apiRequest('/api/security/daily-report', { raw: true }).catch(() => ({ data: null })),
          apiRequest('/api/security/vehicle-logs?limit=100', { raw: true }).catch(() => ({ data: [] })),
          apiRequest('/api/security/all-packages?limit=100', { raw: true }).catch(() => ({ data: [] })),
          apiRequest('/api/security/emergency-alerts?includeResolved=true', { raw: true }).catch(() => ({ data: [] })),
        ]);

        setSecurityReport(dailyReportPayload.data || null);
        setVehicleLogs(vehiclePayload.data || []);
        setAllPackages(packagePayload.data || []);
        setAlerts(alertPayload.data || []);
      } catch (err) {
        setError(err.message || 'Failed to load reports.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const avgOccupancy = useMemo(() => {
    if (!reportData.length) return 0;
    return (reportData.reduce((sum, row) => sum + row.occupancyRate, 0) / reportData.length).toFixed(1);
  }, [reportData]);

  const vehicleTrend = useMemo(() => {
    const map = new Map();
    vehicleLogs.forEach((log) => {
      const key = new Date(log.createdAt).toLocaleDateString();
      map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()].map(([date, count]) => ({ date, count })).slice(-7);
  }, [vehicleLogs]);

  const deliveryStatus = useMemo(() => {
    const received = allPackages.filter((item) => item.status === 'Received').length;
    const delivered = allPackages.filter((item) => item.status === 'Delivered').length;
    return [
      { name: 'Received', value: received, fill: '#0ea5e9' },
      { name: 'Delivered', value: delivered, fill: '#14b8a6' },
    ];
  }, [allPackages]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel dark:border-slate-800 dark:bg-slate-900"
        >
          <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Societies Tracked</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{societies.length}</h3>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel dark:border-slate-800 dark:bg-slate-900"
        >
          <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Avg Occupancy</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{avgOccupancy}%</h3>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel dark:border-slate-800 dark:bg-slate-900"
        >
          <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Visitors Today</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{securityReport?.totalVisitorsToday || 0}</h3>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-panel dark:border-slate-800 dark:bg-slate-900"
        >
          <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Emergency Alerts</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{alerts.length}</h3>
        </motion.div>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Occupancy Trend by Society</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Compare flats and residents to understand utilization.</p>

        {loading ? (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading report data...</p>
        ) : reportData.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No data yet. Add societies and residents to generate reports.</p>
        ) : (
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={reportData}>
                <defs>
                  <linearGradient id="flatsColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="residentsColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#dce6f4" />
                <XAxis dataKey="society" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="flats" stroke="#0ea5e9" fill="url(#flatsColor)" />
                <Area type="monotone" dataKey="residents" stroke="#14b8a6" fill="url(#residentsColor)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </motion.section>

      <div className="grid gap-4 xl:grid-cols-3">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel xl:col-span-2 dark:border-slate-800 dark:bg-slate-900"
        >
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Vehicle Entry Trend (7 days)</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vehicleTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dce6f4" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel dark:border-slate-800 dark:bg-slate-900"
        >
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Delivery Status</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={deliveryStatus} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.section>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Emergency Alerts</h2>
        <ul className="mt-3 space-y-2">
          {alerts.slice(0, 8).map((alert) => (
            <li key={alert._id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/50">
              <p className="font-semibold text-slate-900 dark:text-white">{alert.alertType} - {alert.location}</p>
              <p className="text-slate-600 dark:text-slate-300">{alert.description}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(alert.createdAt).toLocaleString()}</p>
            </li>
          ))}
          {!alerts.length && <p className="text-sm text-slate-500 dark:text-slate-400">No emergency alerts logged.</p>}
        </ul>
      </motion.section>

      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">{error}</p>}
    </div>
  );
}

export default ReportsPage;
