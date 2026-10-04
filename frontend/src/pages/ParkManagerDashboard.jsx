import React, { useState, useEffect } from 'react';
import { 
  Mail, Lock, Phone, Hash, MapPin, UserPlus, 
  LayoutDashboard, Users, Settings, LogOut, ShieldAlert, Compass,
  Radio, CheckCircle2, AlertTriangle, Eye, RefreshCw, ChevronRight, Sliders, Shield
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { apiService } from '../services/api';
import PatrolPlanningManager from '../components/patrolPlanning/PatrolPlanningManager';
import TacticalMap from '../components/patrolPlanning/TacticalMap';
import './Login.css';
import './Dashboard.css';

export default function ParkManagerDashboard() {
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = useState('patrol_planning');
  const [selectedPark, setSelectedPark] = useState('YALA-NP');
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Colombo' }));

  // Live Clock for Sri Lanka Standard Time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Colombo' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Logged-in User Profile (real from Supabase Auth)
  const [userProfile, setUserProfile] = useState({ 
    name: 'Park Manager', 
    initials: 'PM', 
    email: '',
    role: 'Park Operations' 
  });

  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const meta = session.user.user_metadata || {};
          const email = session.user.email || '';
          let displayName = meta.full_name || meta.name || '';
          
          if (!displayName && email) {
            const prefix = email.split('@')[0];
            if (prefix.toLowerCase() === 'pm' || prefix.toLowerCase() === 'park_manager' || prefix.toLowerCase() === 'parkmanager') {
              displayName = 'Park Manager';
            } else {
              displayName = prefix
                .replace(/[._-]+/g, ' ')
                .split(' ')
                .filter(Boolean)
                .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                .join(' ');
            }
          }

          if (!displayName || displayName.toLowerCase() === 'pm' || displayName.toLowerCase() === 'park_manager') {
            displayName = 'Park Manager';
          }

          // Calculate clean 2-letter uppercase initials
          const words = displayName.split(' ').filter(Boolean);
          let initials = 'PM';
          if (words.length >= 2) {
            initials = (words[0][0] + words[1][0]).toUpperCase();
          } else if (words.length === 1) {
            if (words[0].toLowerCase() === 'pm') {
              initials = 'PM';
            } else if (words[0].length >= 2) {
              initials = words[0].slice(0, 2).toUpperCase();
            } else {
              initials = words[0][0].toUpperCase();
            }
          }

          setUserProfile({ 
            name: displayName, 
            initials: initials || 'PM', 
            email,
            role: 'Park Operations'
          });
        }
      } catch (err) {
        console.error('Failed to load user session:', err);
      }
    };
    loadUser();
  }, []);

  // Overview Tab: Real patrol dashboard data
  const [overviewData, setOverviewData] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  const currentParkId = selectedPark === 'WILP-NP' ? 2 : selectedPark === 'UDAW-NP' ? 3 : 1;

  const fetchOverviewData = async () => {
    setOverviewLoading(true);
    try {
      const data = await apiService.getPatrolDashboard(currentParkId);
      setOverviewData(data);
    } catch (err) {
      console.error('Overview fetch error:', err);
    } finally {
      setOverviewLoading(false);
    }
  };

  useEffect(() => {
    if (activeMenu === 'overview') {
      fetchOverviewData();
    }
  }, [activeMenu, currentParkId]);

  // Officer Registration Form State
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    mobileNumber: '',
    age: '',
    assignedCheckpoint: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Officers List State
  const [officers, setOfficers] = useState([]);
  const [loadingOfficers, setLoadingOfficers] = useState(false);

  const fetchOfficers = async () => {
    setLoadingOfficers(true);
    try {
      const { data, error } = await supabase
        .from('rangers')
        .select('*')
        .eq('assigned_park_id', currentParkId);
      if (!error && data) {
        setOfficers(data);
      }
    } catch (err) {
      console.error('Error fetching officers:', err);
    } finally {
      setLoadingOfficers(false);
    }
  };

  useEffect(() => {
    if (activeMenu === 'view_officers') {
      fetchOfficers();
    }
  }, [activeMenu, currentParkId]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handleAddOfficer = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('http://localhost:5000/api/wildlife-officers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create officer');
      }

      setMessage({ type: 'success', text: 'Wildlife Officer registered successfully!' });
      setFormData({ email: '', password: '', mobileNumber: '', age: '', assignedCheckpoint: '' });
      fetchOfficers();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <ShieldAlert size={26} color="#34d399" />
          <span>WildGuard</span>
          <span className="sidebar-logo-tag">OPS</span>
        </div>
        
        <ul className="sidebar-menu">
          <li 
            className={`sidebar-item ${activeMenu === 'patrol_planning' ? 'active' : ''}`} 
            onClick={() => setActiveMenu('patrol_planning')}
          >
            <Compass className="sidebar-item-icon" />
            <span>Patrol Operations</span>
            <span className="sidebar-badge">CORE</span>
          </li>

          <li 
            className={`sidebar-item ${activeMenu === 'overview' ? 'active' : ''}`} 
            onClick={() => setActiveMenu('overview')}
          >
            <LayoutDashboard className="sidebar-item-icon" />
            <span>Command Overview</span>
          </li>

          <li 
            className={`sidebar-item ${activeMenu === 'view_officers' ? 'active' : ''}`} 
            onClick={() => setActiveMenu('view_officers')}
          >
            <Users className="sidebar-item-icon" />
            <span>Field Ranger Roster</span>
          </li>

          <li 
            className={`sidebar-item ${activeMenu === 'add_officer' ? 'active' : ''}`} 
            onClick={() => setActiveMenu('add_officer')}
          >
            <UserPlus className="sidebar-item-icon" />
            <span>Register Officer</span>
          </li>

          <li 
            className={`sidebar-item ${activeMenu === 'settings' ? 'active' : ''}`} 
            onClick={() => setActiveMenu('settings')}
          >
            <Settings className="sidebar-item-icon" />
            <span>Park Settings</span>
          </li>
        </ul>

        {/* Live Grid Indicator in Sidebar Footer */}
        <div style={{ padding: '0 20px', marginTop: 'auto', marginBottom: 12 }}>
          <div style={{ background: 'rgba(6, 78, 59, 0.25)', border: '1px solid rgba(52, 211, 153, 0.2)', borderRadius: 8, padding: '10px 12px', fontSize: '0.72rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#34d399', fontWeight: 700 }}>
              <Radio size={13} />
              <span>IRIDIUM MESH ONLINE</span>
            </div>
            <div style={{ color: '#94a3b8', marginTop: 3 }}>
              SL Time: <strong style={{ color: '#fff' }}>{currentTime}</strong>
            </div>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="logout-btn" onClick={handleLogout}>
            <LogOut size={18} />
            <span>Sign Out</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="top-header">
          <div>
            <div className="header-title">
              {activeMenu === 'patrol_planning' ? 'Patrol Planning & Ranger Dispatch' :
               activeMenu === 'overview' ? 'National Park Operations Command Center' :
               activeMenu === 'view_officers' ? 'Field Ranger Personnel & Deployment Roster' :
               activeMenu === 'add_officer' ? 'New Wildlife Officer Registration' :
               'Park Configuration & Telemetry Thresholds'}
            </div>
            <div className="header-subtitle">
              Department of Wildlife Conservation • Democratic Socialist Republic of Sri Lanka
            </div>
          </div>

          <div className="header-actions">
            {/* Park Selector */}
            <select
              value={selectedPark}
              onChange={(e) => setSelectedPark(e.target.value)}
              style={{
                background: 'rgba(2, 44, 34, 0.9)',
                color: '#34d399',
                border: '1px solid rgba(52, 211, 153, 0.3)',
                borderRadius: 8,
                padding: '7px 12px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <option value="YALA-NP">Yala National Park (Ruhuna) - Sector 7</option>
              <option value="WILP-NP">Wilpattu National Park - Northern Sector</option>
              <option value="UDAW-NP">Udawalawe National Park - Reservoir Basin</option>
            </select>

            {/* User Profile */}
            <div className="user-profile">
              <div className="avatar">{userProfile.initials}</div>
              <div className="user-info">
                <span className="user-name">{userProfile.name}</span>
                <span className="user-role">{userProfile.role || 'Park Operations'}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="content-area">
          {/* 1. Main UC01 Patrol Planning Console */}
          {activeMenu === 'patrol_planning' && (
            <PatrolPlanningManager parkId={currentParkId} />
          )}

          {/* 2. Operations Overview Screen */}
          {activeMenu === 'overview' && (
            <div className="patrol-console-container">
              {overviewLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#34d399', gap: 12 }}>
                  <RefreshCw size={28} className="animate-spin" />
                  <span style={{ fontWeight: 600 }}>Loading Operational Data...</span>
                </div>
              ) : (
                <>
                  <div className="kpi-grid">
                    <div className="kpi-card">
                      <div className="kpi-card-header">
                        <span>Protected Area</span>
                        <span style={{ color: '#34d399' }}>COVERAGE</span>
                      </div>
                      <div className="kpi-card-value">
                        {overviewData?.park?.total_area_sqkm ? `${overviewData.park.total_area_sqkm.toLocaleString()} km²` : '—'}
                      </div>
                      <div className="kpi-card-sub">{overviewData?.park?.name || '—'}</div>
                    </div>

                    <div className="kpi-card">
                      <div className="kpi-card-header">
                        <span>Active Patrol Units</span>
                        <span style={{ color: '#34d399' }}>ON-DUTY</span>
                      </div>
                      <div className="kpi-card-value">{overviewData?.kpi?.activeRangersDeployed || '0/0 Active'}</div>
                      <div className="kpi-card-sub">{overviewData?.kpi?.standbyUnitsCount ?? 0} Units on Standby</div>
                    </div>

                    <div className="kpi-card">
                      <div className="kpi-card-header">
                        <span>Critical Blindspot Zones</span>
                        <span style={{ color: '#ef4444' }}>URGENT</span>
                      </div>
                      <div className="kpi-card-value">
                        {overviewData?.kpi?.blindspotZonesCount ?? '—'} {overviewData?.kpi?.blindspotZonesCount === 1 ? 'Zone' : 'Zones'}
                      </div>
                      <div className="kpi-card-sub" style={{ color: '#f87171' }}>Acoustic Spikes: {overviewData?.kpi?.acousticSpikesLast24h ?? 0} in 24h</div>
                    </div>

                    <div className="kpi-card">
                      <div className="kpi-card-header">
                        <span>Risk Coverage Index</span>
                        <span style={{ color: '#34d399' }}>LIVE</span>
                      </div>
                      <div className="kpi-card-value">{overviewData?.kpi?.riskCoverageIndex || '—'}</div>
                      <div className="kpi-card-sub">Sensor Grid Active</div>
                    </div>
                  </div>

                  <div className="console-split">
                    <div className="panel-card">
                      <div className="panel-header">
                        <div className="panel-title">
                          <Compass size={18} color="#34d399" />
                          <span>Live Tactical Map &amp; Risk Zones</span>
                        </div>
                        <button
                          onClick={fetchOverviewData}
                          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem' }}
                        >
                          <RefreshCw size={13} /> Refresh
                        </button>
                      </div>
                      <TacticalMap park={overviewData?.park} />
                    </div>

                    <div className="panel-card">
                      <div className="panel-header">
                        <div className="panel-title">
                          <AlertTriangle size={18} color="#f59e0b" />
                          <span>Priority Tactical Recommendation</span>
                        </div>
                        <span className="badge-defcon">URGENT</span>
                      </div>

                      {overviewData?.topRecommendedRoute ? (
                        <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #ef4444', borderRadius: 10, padding: 16 }}>
                          <div style={{ color: '#fca5a5', fontWeight: 700, fontSize: '0.95rem' }}>
                            {overviewData.topRecommendedRoute.route_name} Requires Priority Patrol
                          </div>
                          <p style={{ margin: '6px 0 0', color: '#cbd5e1', fontSize: '0.82rem', lineHeight: 1.5 }}>
                            {overviewData.topRecommendedRoute.coverage_gap_percent}% coverage deficit •
                            {' '}{overviewData.topRecommendedRoute.recent_incident_count} recent incident{overviewData.topRecommendedRoute.recent_incident_count !== 1 ? 's' : ''} •
                            {' '}{overviewData.topRecommendedRoute.base_risk_level} risk level.
                          </p>
                          <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                              Threat Score: <strong style={{ color: '#34d399' }}>{overviewData.topRecommendedRoute.threatScore} / 10</strong>
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                              Terrain: <strong style={{ color: '#fff' }}>{overviewData.topRecommendedRoute.terrain_type}</strong>
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div style={{ color: '#94a3b8', fontSize: '0.88rem' }}>No active recommendations at this time.</div>
                      )}

                      <button
                        onClick={() => setActiveMenu('patrol_planning')}
                        className="btn-tactical btn-tactical-primary"
                        style={{ width: '100%', padding: '14px', marginTop: 'auto' }}
                      >
                        <span>Launch Risk-Based Patrol Dispatch</span>
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 3. Field Ranger Roster Screen */}
          {activeMenu === 'view_officers' && (
            <div className="patrol-console-container">
              <div className="panel-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem' }}>Field Ranger Personnel Roster</h3>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Real-time readiness and duty status tracking</span>
                  </div>
                  <button
                    onClick={() => setActiveMenu('add_officer')}
                    className="btn-tactical btn-tactical-primary"
                    style={{ padding: '8px 14px', fontSize: '0.8rem' }}
                  >
                    <UserPlus size={14} /> Register New Officer
                  </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="tactical-table">
                    <thead>
                      <tr>
                        <th>Officer Name / Badge</th>
                        <th>Callsign</th>
                        <th>Duty Status</th>
                        <th>Current Workload</th>
                        <th>Staging Location</th>
                        <th>Certifications</th>
                      </tr>
                    </thead>
                    <tbody>
                      {officers.map((ranger) => (
                        <tr key={ranger.id} className="tactical-row">
                          <td>
                            <div style={{ fontWeight: 700, color: '#fff' }}>{ranger.full_name}</div>
                            <span style={{ fontSize: '0.72rem', color: '#34d399', fontFamily: 'monospace' }}>
                              ID: {ranger.badge_number}
                            </span>
                          </td>
                          <td>
                            <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{ranger.callsign || 'Unit Squad'}</span>
                          </td>
                          <td>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              background: ranger.current_status === 'AVAILABLE' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                              color: ranger.current_status === 'AVAILABLE' ? '#6ee7b7' : '#fde68a',
                              border: `1px solid ${ranger.current_status === 'AVAILABLE' ? '#10b981' : '#f59e0b'}`
                            }}>
                              {ranger.current_status}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontSize: '0.8rem', color: '#fff' }}>
                              {ranger.active_assignments_count} / {ranger.max_active_assignments || 5} Tasks
                            </div>
                            <div className="progress-bar-container" style={{ width: '80px' }}>
                              <div 
                                className="progress-bar-fill" 
                                style={{ 
                                  width: `${(ranger.active_assignments_count / (ranger.max_active_assignments || 5)) * 100}%`,
                                  background: ranger.active_assignments_count >= 4 ? '#ef4444' : '#10b981'
                                }}
                              ></div>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                              {ranger.base_location_name || 'Camp East'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {ranger.certifications?.map((c, i) => (
                                <span key={i} style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8', padding: '1px 5px', borderRadius: 3, fontSize: '0.68rem' }}>
                                  {c}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 4. Add Officer Screen */}
          {activeMenu === 'add_officer' && (
            <div className="dashboard-card-full" style={{ position: 'relative', zIndex: 10 }}>
              <div className="card-header">
                <h2>Register Wildlife Field Officer</h2>
                <p>Create an authorized officer credential and link them to an operational base checkpoint.</p>
              </div>

              {message && (
                <div style={{ 
                  padding: '12px 16px', 
                  borderRadius: '8px', 
                  marginBottom: '24px',
                  background: message.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                  color: message.type === 'error' ? '#fca5a5' : '#6ee7b7',
                  border: `1px solid ${message.type === 'error' ? '#ef4444' : '#10b981'}`
                }}>
                  {message.text}
                </div>
              )}

              <form onSubmit={handleAddOfficer} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flex: '1 1 200px' }}>
                    <label htmlFor="email">Officer Official Email</label>
                    <div className="input-wrapper">
                      <Mail className="input-icon" />
                      <input type="email" id="email" className="form-input" placeholder="officer@wildguard.dwc.gov.lk" value={formData.email} onChange={handleChange} required />
                    </div>
                  </div>

                  <div className="form-group" style={{ flex: '1 1 200px' }}>
                    <label htmlFor="password">Temporary Access Code / Password</label>
                    <div className="input-wrapper">
                      <Lock className="input-icon" />
                      <input type="text" id="password" className="form-input" placeholder="Set field access code" value={formData.password} onChange={handleChange} required minLength="6" />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flex: '2 1 200px' }}>
                    <label htmlFor="mobileNumber">Field Radio / Satellite Contact</label>
                    <div className="input-wrapper">
                      <Phone className="input-icon" />
                      <input type="tel" id="mobileNumber" className="form-input" placeholder="+94 77 123 4567" value={formData.mobileNumber} onChange={handleChange} required />
                    </div>
                  </div>

                  <div className="form-group" style={{ flex: '1 1 100px' }}>
                    <label htmlFor="age">Age</label>
                    <div className="input-wrapper">
                      <Hash className="input-icon" />
                      <input type="number" id="age" className="form-input" placeholder="28" value={formData.age} onChange={handleChange} required min="18" max="65" />
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="assignedCheckpoint">Assigned Staging Post / Checkpoint</label>
                  <div className="input-wrapper">
                    <MapPin className="input-icon" />
                    <input type="text" id="assignedCheckpoint" className="form-input" placeholder="e.g. Camp East Forward Post, Zone 7" value={formData.assignedCheckpoint} onChange={handleChange} required />
                  </div>
                </div>

                <button type="submit" className="submit-btn" disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '16px', padding: '14px' }}>
                  <UserPlus size={18} />
                  <span>{loading ? 'Authorizing Credential...' : 'Complete Officer Commissioning'}</span>
                </button>
              </form>
            </div>
          )}

          {/* 5. Park Settings & Thresholds Screen */}
          {activeMenu === 'settings' && (
            <div className="patrol-console-container">
              <div className="panel-card">
                <div className="panel-header">
                  <div className="panel-title">
                    <Sliders size={18} color="#34d399" />
                    <span>Park Monitoring Rules &amp; Telemetry Thresholds</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="score-metric-row">
                    <div>
                      <div style={{ fontWeight: 600, color: '#fff' }}>Acoustic Snare Spike Alert Threshold</div>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Auto-trigger Critical Alert when sensor anomalies exceed limit</span>
                    </div>
                    <span className="score-badge">≥ 3 spikes / 12h</span>
                  </div>

                  <div className="score-metric-row">
                    <div>
                      <div style={{ fontWeight: 600, color: '#fff' }}>Maximum Ranger Active Task Workload Cap</div>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Enforces welfare &amp; fatigue limits (Resolves OI2)</span>
                    </div>
                    <span className="score-badge">5 Tasks Max</span>
                  </div>

                  <div className="score-metric-row">
                    <div>
                      <div style={{ fontWeight: 600, color: '#fff' }}>Unmonitored Deficit Window Warning</div>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Flag sector as blindspot when unpatrolled</span>
                    </div>
                    <span className="score-badge">&gt; 72 Hours</span>
                  </div>

                  <div className="score-metric-row">
                    <div>
                      <div style={{ fontWeight: 600, color: '#fff' }}>Encrypted Radio Telemetry Protocol</div>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Satellite burst interval across forest canopy</span>
                    </div>
                    <span className="score-badge">45 Mins</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
