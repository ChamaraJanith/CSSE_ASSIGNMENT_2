import React, { useState, useEffect } from 'react';
import { 
  Mail, Lock, Phone, Hash, MapPin, UserPlus, 
  LayoutDashboard, Users, Settings, LogOut, ShieldAlert, Compass,
  Radio, CheckCircle2, AlertTriangle, Eye, RefreshCw, ChevronRight, Sliders, Shield,
  Search, Filter, Save, RotateCcw, AlertCircle, Award, Check
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
  const [availableParks, setAvailableParks] = useState([
    { id: 1, code: 'YALA-NP', name: 'Yala National Park (Ruhuna)' },
    { id: 2, code: 'WILP-NP', name: 'Wilpattu National Park' },
    { id: 3, code: 'UDAW-NP', name: 'Udawalawe National Park' }
  ]);

  // Load registered parks dynamically from Supabase
  useEffect(() => {
    const loadParks = async () => {
      try {
        const { data, error } = await supabase.from('parks').select('id, code, name').order('id');
        if (!error && data && data.length > 0) {
          setAvailableParks(data);
        }
      } catch (err) {
        console.error('Failed to load parks:', err);
      }
    };
    loadParks();
  }, []);

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

  // -------------------------------------------------------------
  // 3. Field Ranger Personnel & Roster State
  // -------------------------------------------------------------
  const [officers, setOfficers] = useState([]);
  const [loadingOfficers, setLoadingOfficers] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [updatingRangerId, setUpdatingRangerId] = useState(null);

  const fetchOfficers = async () => {
    setLoadingOfficers(true);
    try {
      const data = await apiService.getRangersByPark(currentParkId);
      if (Array.isArray(data)) {
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

  const handleUpdateRangerStatus = async (rangerId, newStatus) => {
    try {
      setUpdatingRangerId(rangerId);
      await apiService.updateRangerStatus(rangerId, newStatus);
      setOfficers(prev => prev.map(r => r.id === rangerId ? { ...r, current_status: newStatus } : r));
    } catch (err) {
      console.error('Failed to update ranger status:', err);
      alert(`Status update failed: ${err.message}`);
    } finally {
      setUpdatingRangerId(null);
    }
  };

  // -------------------------------------------------------------
  // 4. Officer Commissioning Form State (Real DB rangers registration)
  // -------------------------------------------------------------
  const [officerForm, setOfficerForm] = useState({
    fullName: '',
    badgeNumber: '',
    callsign: '',
    assignedParkId: currentParkId,
    baseLocationName: '',
    email: '',
    password: '',
    mobileNumber: '',
    maxActiveAssignments: 5,
    certifications: ['GPS & Night Tracking', 'Wildlife First Aid & Triage']
  });
  const [loadingCommission, setLoadingCommission] = useState(false);
  const [commissionMessage, setCommissionMessage] = useState(null);

  const availableCertifications = [
    'GPS & Night Tracking',
    'Anti-Poaching Rapid Response',
    'Wildlife First Aid & Triage',
    'Heavy 4x4 Offroad Dispatch',
    'Drone Aerial Reconnaissance',
    'Elephant Conflict Mitigation'
  ];

  const handleToggleCertification = (cert) => {
    setOfficerForm(prev => {
      const exists = prev.certifications.includes(cert);
      return {
        ...prev,
        certifications: exists ? prev.certifications.filter(c => c !== cert) : [...prev.certifications, cert]
      };
    });
  };

  const handleCommissionOfficer = async (e) => {
    e.preventDefault();
    setLoadingCommission(true);
    setCommissionMessage(null);

    try {
      await apiService.registerRanger({
        ...officerForm,
        assignedParkId: currentParkId
      });

      const parkName = availableParks.find(p => p.id === currentParkId)?.name || 'the National Park';
      setCommissionMessage({
        type: 'success',
        text: `Officer ${officerForm.fullName} (${officerForm.callsign}) successfully commissioned to ${parkName}!`
      });

      // Reset form
      setOfficerForm({
        fullName: '',
        badgeNumber: '',
        callsign: '',
        assignedParkId: currentParkId,
        baseLocationName: '',
        email: '',
        password: '',
        mobileNumber: '',
        maxActiveAssignments: 5,
        certifications: ['GPS & Night Tracking', 'Wildlife First Aid & Triage']
      });

      fetchOfficers();
    } catch (err) {
      setCommissionMessage({ type: 'error', text: err.message });
    } finally {
      setLoadingCommission(false);
    }
  };

  // -------------------------------------------------------------
  // 5. Park Settings & Telemetry Thresholds State
  // -------------------------------------------------------------
  const [parkSettings, setParkSettings] = useState({
    acoustic_spike_threshold: 3,
    max_ranger_workload: 5,
    unmonitored_blindspot_hours: 72,
    telemetry_interval_mins: 45,
    target_coverage_percent: 90
  });
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState(null);

  const fetchParkSettings = async () => {
    setLoadingSettings(true);
    try {
      const data = await apiService.getParkSettings(currentParkId);
      if (data) {
        setParkSettings({
          acoustic_spike_threshold: data.acoustic_spike_threshold ?? 3,
          max_ranger_workload: data.max_ranger_workload ?? 5,
          unmonitored_blindspot_hours: data.unmonitored_blindspot_hours ?? 72,
          telemetry_interval_mins: data.telemetry_interval_mins ?? 45,
          target_coverage_percent: data.target_coverage_percent ?? 90
        });
      }
    } catch (err) {
      console.error('Error fetching park settings:', err);
    } finally {
      setLoadingSettings(false);
    }
  };

  useEffect(() => {
    if (activeMenu === 'settings') {
      fetchParkSettings();
    }
  }, [activeMenu, currentParkId]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsMessage(null);
    try {
      await apiService.updateParkSettings(currentParkId, parkSettings);
      setSettingsMessage({ type: 'success', text: 'Park monitoring rules & telemetry thresholds successfully saved to database.' });
    } catch (err) {
      setSettingsMessage({ type: 'error', text: err.message });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetSettings = () => {
    setParkSettings({
      acoustic_spike_threshold: 3,
      max_ranger_workload: 5,
      unmonitored_blindspot_hours: 72,
      telemetry_interval_mins: 45,
      target_coverage_percent: 90
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
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
            {/* National Park Jurisdiction Selector */}
            <select
              value={selectedPark}
              onChange={(e) => setSelectedPark(e.target.value)}
              style={{
                background: 'rgba(2, 44, 34, 0.9)',
                color: '#34d399',
                border: '1px solid rgba(52, 211, 153, 0.3)',
                borderRadius: 8,
                padding: '7px 14px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {availableParks.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
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

          {/* 3. Field Ranger Personnel & Deployment Roster Screen */}
          {activeMenu === 'view_officers' && (
            <div className="patrol-console-container">
              {/* Roster KPI Summary Grid */}
              <div className="kpi-grid">
                <div className="kpi-card">
                  <div className="kpi-card-header">
                    <span>Field Strength</span>
                    <span style={{ color: '#34d399' }}>PERSONNEL</span>
                  </div>
                  <div className="kpi-card-value">{officers.length} Rangers</div>
                  <div className="kpi-card-sub">Assigned to {availableParks.find(p => p.id === currentParkId)?.name || 'Park'}</div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-card-header">
                    <span>Ready for Dispatch</span>
                    <span style={{ color: '#10b981' }}>STANDBY</span>
                  </div>
                  <div className="kpi-card-value" style={{ color: '#34d399' }}>
                    {officers.filter(o => o.current_status === 'AVAILABLE').length}
                  </div>
                  <div className="kpi-card-sub">Cleared for immediate patrol</div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-card-header">
                    <span>Active on Duty</span>
                    <span style={{ color: '#f59e0b' }}>DEPLOYED</span>
                  </div>
                  <div className="kpi-card-value" style={{ color: '#fbbf24' }}>
                    {officers.filter(o => o.current_status === 'ON_DUTY' || o.current_status === 'DEPLOYED').length}
                  </div>
                  <div className="kpi-card-sub">In field or active tracking</div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-card-header">
                    <span>Resting / Inactive</span>
                    <span style={{ color: '#94a3b8' }}>MANDATORY REST</span>
                  </div>
                  <div className="kpi-card-value" style={{ color: '#cbd5e1' }}>
                    {officers.filter(o => o.current_status === 'RESTING').length}
                  </div>
                  <div className="kpi-card-sub">Fatigue rotation recovery</div>
                </div>
              </div>

              {/* Roster Table Card */}
              <div className="panel-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem' }}>Field Ranger Personnel &amp; Deployment Roster</h3>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Live operational readiness, staging outpost, and workload fatigue tracking</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button
                      onClick={fetchOfficers}
                      className="btn-tactical btn-tactical-secondary"
                      style={{ padding: '8px 12px', fontSize: '0.78rem' }}
                      title="Refresh Roster"
                    >
                      <RefreshCw size={13} className={loadingOfficers ? 'animate-spin' : ''} />
                      <span>Sync</span>
                    </button>
                    <button
                      onClick={() => setActiveMenu('add_officer')}
                      className="btn-tactical btn-tactical-primary"
                      style={{ padding: '8px 14px', fontSize: '0.8rem' }}
                    >
                      <UserPlus size={14} /> Commission New Officer
                    </button>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#64748b' }} />
                    <input
                      type="text"
                      placeholder="Search by name, callsign, or badge..."
                      value={rosterSearch}
                      onChange={(e) => setRosterSearch(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(52,211,153,0.2)',
                        borderRadius: 6,
                        padding: '7px 10px 7px 32px',
                        color: '#fff',
                        fontSize: '0.8rem'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginRight: 4 }}>Filter Status:</span>
                    {['ALL', 'AVAILABLE', 'ON_DUTY', 'RESTING'].map(st => (
                      <button
                        key={st}
                        onClick={() => setStatusFilter(st)}
                        style={{
                          background: statusFilter === st ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${statusFilter === st ? '#34d399' : 'rgba(255,255,255,0.1)'}`,
                          color: statusFilter === st ? '#34d399' : '#94a3b8',
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {st === 'ALL' ? 'All Units' : st}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="tactical-table">
                    <thead>
                      <tr>
                        <th>Officer Name / Badge</th>
                        <th>Callsign</th>
                        <th>Duty Status (Live Control)</th>
                        <th>Current Workload</th>
                        <th>Staging Location</th>
                        <th>Specializations</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {officers
                        .filter(ranger => {
                          const matchesSearch = !rosterSearch || 
                            ranger.full_name?.toLowerCase().includes(rosterSearch.toLowerCase()) ||
                            ranger.callsign?.toLowerCase().includes(rosterSearch.toLowerCase()) ||
                            ranger.badge_number?.toLowerCase().includes(rosterSearch.toLowerCase());
                          const matchesStatus = statusFilter === 'ALL' || ranger.current_status === statusFilter;
                          return matchesSearch && matchesStatus;
                        })
                        .map((ranger) => {
                          const maxTasks = ranger.max_active_assignments || 5;
                          const taskCount = ranger.active_assignments_count || 0;
                          const isFatigued = taskCount >= maxTasks;
                          const isUpdating = updatingRangerId === ranger.id;

                          return (
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <select
                                    value={ranger.current_status}
                                    disabled={isUpdating}
                                    onChange={(e) => handleUpdateRangerStatus(ranger.id, e.target.value)}
                                    style={{
                                      background: ranger.current_status === 'AVAILABLE' ? 'rgba(16, 185, 129, 0.2)' : ranger.current_status === 'ON_DUTY' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(100, 116, 139, 0.25)',
                                      color: ranger.current_status === 'AVAILABLE' ? '#6ee7b7' : ranger.current_status === 'ON_DUTY' ? '#fde68a' : '#cbd5e1',
                                      border: `1px solid ${ranger.current_status === 'AVAILABLE' ? '#10b981' : ranger.current_status === 'ON_DUTY' ? '#f59e0b' : '#64748b'}`,
                                      borderRadius: 6,
                                      padding: '4px 8px',
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <option value="AVAILABLE" style={{ background: '#06261d', color: '#6ee7b7' }}>AVAILABLE</option>
                                    <option value="ON_DUTY" style={{ background: '#261b06', color: '#fde68a' }}>ON_DUTY</option>
                                    <option value="RESTING" style={{ background: '#1e293b', color: '#cbd5e1' }}>RESTING</option>
                                  </select>
                                  {isUpdating && <RefreshCw size={12} className="animate-spin" color="#34d399" />}
                                </div>
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontSize: '0.8rem', color: isFatigued ? '#ef4444' : '#fff', fontWeight: isFatigued ? 700 : 500 }}>
                                    {taskCount} / {maxTasks} Tasks
                                  </span>
                                  {isFatigued && (
                                    <span style={{ fontSize: '0.65rem', background: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '1px solid #ef4444', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                                      CAP REACHED
                                    </span>
                                  )}
                                </div>
                                <div className="progress-bar-container" style={{ width: '85px', marginTop: 4 }}>
                                  <div 
                                    className="progress-bar-fill" 
                                    style={{ 
                                      width: `${Math.min((taskCount / maxTasks) * 100, 100)}%`,
                                      background: isFatigued ? '#ef4444' : taskCount >= 3 ? '#f59e0b' : '#10b981'
                                    }}
                                  ></div>
                                </div>
                              </td>
                              <td>
                                <span style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                                  {ranger.base_location_name || 'Camp East Outpost'}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 220 }}>
                                  {ranger.certifications?.map((c, i) => (
                                    <span key={i} style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8', padding: '1px 6px', borderRadius: 3, fontSize: '0.68rem', whiteSpace: 'nowrap' }}>
                                      {c}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td>
                                <button
                                  onClick={() => setActiveMenu('patrol_planning')}
                                  className="btn-tactical btn-tactical-secondary"
                                  style={{ padding: '5px 10px', fontSize: '0.72rem' }}
                                  title="Dispatch in Patrol Operations"
                                >
                                  <span>Dispatch</span>
                                  <ChevronRight size={12} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      {officers.length === 0 && !loadingOfficers && (
                        <tr>
                          <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                            No rangers commissioned to this park yet. Click "Commission New Officer" to add field personnel.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 4. Commission New Wildlife Officer Screen */}
          {activeMenu === 'add_officer' && (
            <div className="patrol-console-container" style={{ maxWidth: 960, margin: '0 auto' }}>
              <div className="panel-card" style={{ padding: '28px 32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <ShieldAlert size={24} color="#34d399" />
                  <div>
                    <h2 style={{ margin: 0, color: '#fff', fontSize: '1.25rem' }}>Commission Wildlife Field Ranger</h2>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      Register an authorized officer into the active tactical roster, establish base staging post, and enforce fatigue workload boundaries.
                    </span>
                  </div>
                </div>

                {commissionMessage && (
                  <div style={{ 
                    padding: '14px 18px', 
                    borderRadius: '8px', 
                    margin: '20px 0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: commissionMessage.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                    color: commissionMessage.type === 'error' ? '#fca5a5' : '#6ee7b7',
                    border: `1px solid ${commissionMessage.type === 'error' ? '#ef4444' : '#10b981'}`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {commissionMessage.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{commissionMessage.text}</span>
                    </div>
                    {commissionMessage.type === 'success' && (
                      <button
                        onClick={() => setActiveMenu('view_officers')}
                        className="btn-tactical btn-tactical-primary"
                        style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                      >
                        View in Roster
                      </button>
                    )}
                  </div>
                )}

                <form onSubmit={handleCommissionOfficer} style={{ display: 'flex', flexDirection: 'column', gap: '22px', marginTop: 16 }}>
                  {/* Identity Section */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px' }}>
                    <div className="form-group">
                      <label style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                        Officer Full Name *
                      </label>
                      <input 
                        type="text" 
                        required 
                        className="form-input" 
                        placeholder="e.g. Capt. Sunil Jayasundara" 
                        value={officerForm.fullName} 
                        onChange={(e) => setOfficerForm({ ...officerForm, fullName: e.target.value })} 
                      />
                    </div>

                    <div className="form-group">
                      <label style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                        Official Service Badge ID *
                      </label>
                      <input 
                        type="text" 
                        required 
                        className="form-input" 
                        placeholder="e.g. RNG-YL-015" 
                        value={officerForm.badgeNumber} 
                        onChange={(e) => setOfficerForm({ ...officerForm, badgeNumber: e.target.value })} 
                      />
                    </div>

                    <div className="form-group">
                      <label style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                        Tactical Callsign *
                      </label>
                      <input 
                        type="text" 
                        required 
                        className="form-input" 
                        placeholder="e.g. Delta Falcon / Viper Lead" 
                        value={officerForm.callsign} 
                        onChange={(e) => setOfficerForm({ ...officerForm, callsign: e.target.value })} 
                      />
                    </div>
                  </div>

                  {/* Operational Assignment Section */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px' }}>
                    <div className="form-group">
                      <label style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                        Assigned National Park *
                      </label>
                      <select 
                        className="form-input"
                        value={officerForm.assignedParkId}
                        onChange={(e) => setOfficerForm({ ...officerForm, assignedParkId: parseInt(e.target.value, 10) })}
                      >
                        {availableParks.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                        Forward Staging Camp / Base Outpost *
                      </label>
                      <input 
                        type="text" 
                        required 
                        className="form-input" 
                        placeholder="e.g. Katagamuwa Entrance Post" 
                        value={officerForm.baseLocationName} 
                        onChange={(e) => setOfficerForm({ ...officerForm, baseLocationName: e.target.value })} 
                      />
                    </div>

                    <div className="form-group">
                      <label style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                        Workload Fatigue Cap (Tasks)
                      </label>
                      <input 
                        type="number" 
                        min="1" 
                        max="10" 
                        className="form-input" 
                        value={officerForm.maxActiveAssignments} 
                        onChange={(e) => setOfficerForm({ ...officerForm, maxActiveAssignments: e.target.value })} 
                      />
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 4, display: 'block' }}>
                        Operational fatigue limit (OI2: standard max 5 tasks)
                      </span>
                    </div>
                  </div>

                  {/* Communications & Security Credentials */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px' }}>
                    <div className="form-group">
                      <label style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                        Official Email (DWC Portal Login)
                      </label>
                      <input 
                        type="email" 
                        className="form-input" 
                        placeholder="officer@wildguard.dwc.gov.lk" 
                        value={officerForm.email} 
                        onChange={(e) => setOfficerForm({ ...officerForm, email: e.target.value })} 
                      />
                    </div>

                    <div className="form-group">
                      <label style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                        Field Radio / Mobile Frequency
                      </label>
                      <input 
                        type="tel" 
                        className="form-input" 
                        placeholder="+94 77 123 4567 / VHF Ch 14" 
                        value={officerForm.mobileNumber} 
                        onChange={(e) => setOfficerForm({ ...officerForm, mobileNumber: e.target.value })} 
                      />
                    </div>

                    <div className="form-group">
                      <label style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                        Temporary Field Access Code
                      </label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="FieldPin#2026" 
                        value={officerForm.password} 
                        onChange={(e) => setOfficerForm({ ...officerForm, password: e.target.value })} 
                      />
                    </div>
                  </div>

                  {/* Tactical Specializations / Certifications */}
                  <div className="form-group">
                    <label style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: 8 }}>
                      Tactical Specializations &amp; Certifications
                    </label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {availableCertifications.map(cert => {
                        const isChecked = officerForm.certifications.includes(cert);
                        return (
                          <div
                            key={cert}
                            onClick={() => handleToggleCertification(cert)}
                            style={{
                              background: isChecked ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${isChecked ? '#10b981' : 'rgba(255,255,255,0.1)'}`,
                              color: isChecked ? '#34d399' : '#94a3b8',
                              padding: '6px 12px',
                              borderRadius: 6,
                              fontSize: '0.76rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6
                            }}
                          >
                            <input 
                              type="checkbox" 
                              checked={isChecked} 
                              onChange={() => {}} 
                              style={{ cursor: 'pointer', accentColor: '#10b981' }} 
                            />
                            <span>{cert}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 14, justifyContent: 'flex-end', marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={() => setActiveMenu('view_officers')}
                      className="btn-tactical btn-tactical-secondary"
                      style={{ padding: '12px 20px' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loadingCommission}
                      className="btn-tactical btn-tactical-primary"
                      style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      {loadingCommission ? <RefreshCw size={16} className="animate-spin" /> : <UserPlus size={16} />}
                      <span>{loadingCommission ? 'Authorizing & Commissioning...' : 'Commission Officer to Active Duty'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* 5. Park Settings & Telemetry Thresholds Screen */}
          {activeMenu === 'settings' && (
            <div className="patrol-console-container" style={{ maxWidth: 960, margin: '0 auto' }}>
              <div className="panel-card" style={{ padding: '28px 32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Sliders size={24} color="#34d399" />
                    <div>
                      <h2 style={{ margin: 0, color: '#fff', fontSize: '1.25rem' }}>Park Monitoring Rules &amp; Telemetry Thresholds</h2>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        Configure sensor anomaly triggers, unmonitored blindspot limits, and ranger fatigue caps for {availableParks.find(p => p.id === currentParkId)?.name || 'this National Park'}.
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={fetchParkSettings}
                      className="btn-tactical btn-tactical-secondary"
                      style={{ padding: '8px 12px', fontSize: '0.78rem' }}
                      title="Reload saved settings"
                    >
                      <RefreshCw size={13} className={loadingSettings ? 'animate-spin' : ''} />
                      <span>Reload</span>
                    </button>
                    <button
                      onClick={handleResetSettings}
                      className="btn-tactical btn-tactical-secondary"
                      style={{ padding: '8px 12px', fontSize: '0.78rem' }}
                      title="Reset to DWC Default Standards"
                    >
                      <RotateCcw size={13} />
                      <span>Reset Defaults</span>
                    </button>
                  </div>
                </div>

                {settingsMessage && (
                  <div style={{ 
                    padding: '14px 18px', 
                    borderRadius: '8px', 
                    marginBottom: 20,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: settingsMessage.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                    color: settingsMessage.type === 'error' ? '#fca5a5' : '#6ee7b7',
                    border: `1px solid ${settingsMessage.type === 'error' ? '#ef4444' : '#10b981'}`
                  }}>
                    {settingsMessage.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{settingsMessage.text}</span>
                  </div>
                )}

                <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {/* Metric 1: Acoustic Snare Spike Alert Threshold */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.92rem' }}>
                          Acoustic Snare &amp; Gunshot Spike Alert Threshold
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          Auto-trigger high-priority alert when sensor anomalies exceed this count in a 12-hour window.
                        </span>
                      </div>
                      <span className="score-badge" style={{ fontSize: '0.85rem', padding: '4px 12px' }}>
                        ≥ {parkSettings.acoustic_spike_threshold} spikes / 12h
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="10" 
                      step="1"
                      value={parkSettings.acoustic_spike_threshold}
                      onChange={(e) => setParkSettings({ ...parkSettings, acoustic_spike_threshold: parseInt(e.target.value, 10) })}
                      style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b', marginTop: 4 }}>
                      <span>1 spike (Sensitive)</span>
                      <span>5 spikes (Standard)</span>
                      <span>10 spikes (High Tolerance)</span>
                    </div>
                  </div>

                  {/* Metric 2: Ranger Workload Cap (Fatigue Limit - OI2) */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.92rem' }}>
                          Maximum Ranger Active Task Workload Cap (Fatigue Limit)
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          Enforces ranger welfare and prevents hazardous field fatigue (Resolves Operational Improvement OI2).
                        </span>
                      </div>
                      <span className="score-badge" style={{ fontSize: '0.85rem', padding: '4px 12px' }}>
                        {parkSettings.max_ranger_workload} Tasks Max
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="10" 
                      step="1"
                      value={parkSettings.max_ranger_workload}
                      onChange={(e) => setParkSettings({ ...parkSettings, max_ranger_workload: parseInt(e.target.value, 10) })}
                      style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b', marginTop: 4 }}>
                      <span>1 Task (Strict)</span>
                      <span>5 Tasks (Standard Cap)</span>
                      <span>10 Tasks (Emergency Surge)</span>
                    </div>
                  </div>

                  {/* Metric 3: Unmonitored Blindspot Window Limit */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.92rem' }}>
                          Unmonitored Deficit Window Warning (Blindspot Threshold)
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          Flag sector or corridor as critical blindspot when no patrol has traversed the sector within this time.
                        </span>
                      </div>
                      <span className="score-badge" style={{ fontSize: '0.85rem', padding: '4px 12px' }}>
                        &gt; {parkSettings.unmonitored_blindspot_hours} Hours
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="24" 
                      max="168" 
                      step="6"
                      value={parkSettings.unmonitored_blindspot_hours}
                      onChange={(e) => setParkSettings({ ...parkSettings, unmonitored_blindspot_hours: parseInt(e.target.value, 10) })}
                      style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b', marginTop: 4 }}>
                      <span>24 Hours (Daily Patrol)</span>
                      <span>72 Hours (Standard Limit)</span>
                      <span>168 Hours (Weekly Window)</span>
                    </div>
                  </div>

                  {/* Metric 4: Encrypted Satellite Telemetry Interval */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.92rem' }}>
                          Encrypted Radio Telemetry Protocol Interval
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          Satellite burst interval across forest canopy for sensor telemetry health updates.
                        </span>
                      </div>
                      <span className="score-badge" style={{ fontSize: '0.85rem', padding: '4px 12px' }}>
                        {parkSettings.telemetry_interval_mins} Mins
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="15" 
                      max="120" 
                      step="5"
                      value={parkSettings.telemetry_interval_mins}
                      onChange={(e) => setParkSettings({ ...parkSettings, telemetry_interval_mins: parseInt(e.target.value, 10) })}
                      style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b', marginTop: 4 }}>
                      <span>15 Mins (Fast Burst)</span>
                      <span>45 Mins (Nominal)</span>
                      <span>120 Mins (Battery Conservation)</span>
                    </div>
                  </div>

                  {/* Metric 5: Target Protective Coverage */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.92rem' }}>
                          Target Protective Coverage Goal
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          Park-wide protective coverage goal across critical risk zones and corridors.
                        </span>
                      </div>
                      <span className="score-badge" style={{ fontSize: '0.85rem', padding: '4px 12px' }}>
                        {parkSettings.target_coverage_percent}% Coverage
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="50" 
                      max="100" 
                      step="5"
                      value={parkSettings.target_coverage_percent}
                      onChange={(e) => setParkSettings({ ...parkSettings, target_coverage_percent: parseInt(e.target.value, 10) })}
                      style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b', marginTop: 4 }}>
                      <span>50% (Minimum)</span>
                      <span>90% (Standard Objective)</span>
                      <span>100% (Full Grid Saturation)</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 14, marginTop: 10 }}>
                    <button
                      type="submit"
                      disabled={savingSettings}
                      className="btn-tactical btn-tactical-primary"
                      style={{ padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      {savingSettings ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                      <span>{savingSettings ? 'Persisting Thresholds...' : 'Save & Persist Configuration'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
