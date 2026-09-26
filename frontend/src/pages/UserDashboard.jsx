import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import {
  LayoutDashboard, Map, Info, LogOut, ShieldAlert, FileText, Camera, MapPin
} from 'lucide-react';
import './Dashboard.css';

export default function UserDashboard() {
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = useState('dashboard');

  // Form State
  const [formData, setFormData] = useState({
    incidentType: 'ELEPHANT_SIGHTING',
    otherIncidentType: '',
    description: '',
    incidentDate: '',
    ongoingRisk: false,
    area: '',
    landmark: '',
    gpsCoordinates: '',
    reporterName: '',
    contactNumber: '',
    contactMethod: 'PHONE',
    evidenceFile: null,
    consentGiven: false
  });
  const [loading, setLoading] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(null);
  const [viewReportData, setViewReportData] = useState(null);
  const [searchReportId, setSearchReportId] = useState('');
  const [allReports, setAllReports] = useState([]);

  // Clarification State
  const [clarificationText, setClarificationText] = useState('');
  const [clarificationFile, setClarificationFile] = useState(null);
  const [submittingClarification, setSubmittingClarification] = useState(false);

  useEffect(() => {
    if (activeMenu === 'track-report') {
      const fetchReports = async () => {
        try {
          const { data: userData } = await supabase.auth.getUser();
          const userId = userData?.user?.id;
          
          let url = 'http://localhost:5000/api/reports/conflict';
          if (userId) {
            url += `?userId=${userId}`;
          }
          
          const res = await fetch(url);
          if (res.ok) {
            const result = await res.json();
            setAllReports(result.data);
          }
        } catch (err) {
          console.error("Failed to fetch reports", err);
        }
      };
      fetchReports();
    }
  }, [activeMenu]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handleInputChange = (e) => {
    const { id, value, type, checked } = e.target;
    setFormData({ ...formData, [id]: type === 'checkbox' ? checked : value });
  };

  const handleContactMethodChange = (e) => {
    setFormData({ ...formData, contactMethod: e.target.value });
  };
  
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("File is too large. Maximum size is 5 MB.");
        return;
      }
      setFormData({ ...formData, evidenceFile: file });
    }
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (formData.incidentType === 'OTHER' && !formData.otherIncidentType.trim()) {
      alert("Please specify the incident type.");
      return;
    }
    if (formData.description.length < 15) {
      alert("Please provide more details in the description (minimum 15 characters).");
      return;
    }
    if (!formData.contactMethod) {
      alert("Please choose at least one preferred contact method.");
      return;
    }
    if (!formData.evidenceFile) {
      alert("Evidence photo is required. Please upload a photo before submitting.");
      return;
    }
    if (!formData.consentGiven) {
      alert("Please confirm that the information is accurate.");
      return;
    }
    
    setLoading(true);
    
    // Structure payload according to JSON spec
    let lat = null, lng = null;
    if (formData.gpsCoordinates) {
      const parts = formData.gpsCoordinates.split(',');
      if (parts.length === 2) {
        lat = parseFloat(parts[0].trim());
        lng = parseFloat(parts[1].trim());
      }
    }

    const prefix = formData.area ? formData.area.substring(0, 4).toUpperCase() : 'WILD';
    const reportCode = `INCR-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    
    // Get logged in user to attach to the report
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id || null;

    let finalEvidenceUrl = null;
    if (formData.evidenceFile) {
      const fileExt = formData.evidenceFile.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.floor(Math.random() * 1000)}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('evidence')
        .upload(fileName, formData.evidenceFile);
        
      if (error) {
        alert("Error uploading image: " + error.message);
        setLoading(false);
        return;
      }
      
      const { data: { publicUrl } } = supabase.storage
        .from('evidence')
        .getPublicUrl(fileName);
        
      finalEvidenceUrl = publicUrl;
    }

    const payload = {
      incidentType: formData.incidentType === 'OTHER' ? formData.otherIncidentType : formData.incidentType,
      incidentDateTime: formData.incidentDate,
      description: formData.description,
      immediateRisk: formData.ongoingRisk,
      
      area: formData.area,
      landmark: formData.landmark,
      latitude: lat,
      longitude: lng,
      
      reporterName: formData.reporterName,
      contactNumber: formData.contactNumber,
      preferredContactMethod: formData.contactMethod,
      evidenceUrl: finalEvidenceUrl,
      
      consentConfirmed: formData.consentGiven,
      
      status: "NEW",
      priority: null,
      createdAt: new Date().toISOString(),
      reportCode: reportCode,
      user_id: userId
    };

    console.log("Submitting Payload to Backend:", JSON.stringify(payload, null, 2));

    try {
      const response = await fetch('http://localhost:5000/api/reports/conflict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit report');
      }

      setReportSuccess({ 
        id: reportCode, 
        status: 'NEW', 
        date: new Date().toLocaleString() 
      });
      
      // Reset form but keep contact info for convenience
      setFormData({
        ...formData,
        incidentType: 'ELEPHANT_SIGHTING', otherIncidentType: '', description: '', incidentDate: '',
        ongoingRisk: false, area: '', landmark: '', gpsCoordinates: '', evidenceFile: null, consentGiven: false
      });
    } catch (error) {
      alert("Error submitting report: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <ShieldAlert size={28} />
          WildGuard
        </div>
        <ul className="sidebar-menu">
          <li className={`sidebar-item ${activeMenu === 'dashboard' ? 'active' : ''}`} onClick={() => { setActiveMenu('dashboard'); setReportSuccess(null); }}>
            <LayoutDashboard className="sidebar-item-icon" /> Home
          </li>
          <li className={`sidebar-item ${activeMenu === 'explore' ? 'active' : ''}`} onClick={() => { setActiveMenu('explore'); setReportSuccess(null); }}>
            <Map className="sidebar-item-icon" /> Explore Parks
          </li>
          <li className={`sidebar-item ${activeMenu === 'report' ? 'active' : ''}`} onClick={() => setActiveMenu('report')}>
            <FileText className="sidebar-item-icon" /> Report Incident
          </li>
          <li className={`sidebar-item ${activeMenu === 'track-report' ? 'active' : ''}`} onClick={() => { setActiveMenu('track-report'); setViewReportData(null); setSearchReportId(''); }}>
            <ShieldAlert className="sidebar-item-icon" /> Track Report
          </li>
          <li className={`sidebar-item ${activeMenu === 'gallery' ? 'active' : ''}`} onClick={() => { setActiveMenu('gallery'); setReportSuccess(null); }}>
            <Camera className="sidebar-item-icon" /> Wildlife Gallery
          </li>
          <li className={`sidebar-item ${activeMenu === 'about' ? 'active' : ''}`} onClick={() => { setActiveMenu('about'); setReportSuccess(null); }}>
            <Info className="sidebar-item-icon" /> About Us
          </li>
        </ul>
        <div className="sidebar-footer">
          <div className="logout-btn" onClick={handleLogout}>
            <LogOut size={20} /> Logout
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <div className="bg-blob blob-tr"></div>
        <div className="bg-blob blob-bl"></div>

        <header className="top-header">
          <div className="header-title">{activeMenu === 'report' ? 'Report an Incident' : 'Welcome to WildGuard'}</div>
          <div className="user-profile">
            <div className="user-info">
              <span className="user-name">Nature Lover</span>
              <span className="user-role">Community Member</span>
            </div>
            <div className="avatar" style={{ background: 'linear-gradient(135deg, #14b8a6, #0f766e)' }}>U</div>
          </div>
        </header>

        <div className="content-area">
          {activeMenu === 'dashboard' && (
            <>
              {/* Stats / Info */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                {[
                  { label: 'Parks Visited', value: '2', color: '#14b8a6' },
                  { label: 'Sightings Shared', value: '5', color: '#8b5cf6' },
                  { label: 'Incidents Reported', value: '0', color: '#ef4444' },
                ].map((stat, i) => (
                  <div key={i} className="dashboard-card-full" style={{ padding: '24px', position: 'relative', zIndex: 10 }}>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: stat.color }}>{stat.value}</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '8px' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              <div className="dashboard-card-full" style={{ position: 'relative', zIndex: 10 }}>
                <div className="card-header">
                  <h2>Protect & Explore</h2>
                  <p>Discover wildlife, report suspicious activities, and help us conserve nature.</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                  <div style={{ background: 'rgba(20, 184, 166, 0.1)', border: '1px solid rgba(20, 184, 166, 0.2)', padding: '20px', borderRadius: '12px' }}>
                    <h3 style={{ color: '#14b8a6', margin: '0 0 10px 0' }}>Latest Sightings</h3>
                    <p style={{ color: '#cbd5e1', fontSize: '0.9rem', margin: 0 }}>View the latest animal sightings reported by the community in your area.</p>
                  </div>
                  <div 
                    style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '20px', borderRadius: '12px', cursor: 'pointer' }}
                    onClick={() => setActiveMenu('report')}
                  >
                    <h3 style={{ color: '#ef4444', margin: '0 0 10px 0' }}>Report an Issue</h3>
                    <p style={{ color: '#cbd5e1', fontSize: '0.9rem', margin: 0 }}>Help us protect wildlife by reporting poaching, fires, or injured animals. Click here.</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeMenu === 'report' && reportSuccess && (
            <div className="dashboard-card-full" style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
                <ShieldAlert size={40} color="#10b981" />
              </div>
              <h2 style={{ color: '#10b981', marginBottom: '8px' }}>Incident Report Submitted Successfully</h2>
              <p style={{ color: '#94a3b8', marginBottom: '24px' }}>A Community Liaison Officer will review your report shortly.</p>
              
              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '20px', maxWidth: '400px', margin: '0 auto 30px auto', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ color: '#94a3b8' }}>Report ID:</span>
                  <span style={{ color: '#e2e8f0', fontWeight: 'bold' }}>{reportSuccess.id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ color: '#94a3b8' }}>Status:</span>
                  <span style={{ color: '#f59e0b', fontWeight: 'bold', background: 'rgba(245, 158, 11, 0.2)', padding: '2px 8px', borderRadius: '4px' }}>{reportSuccess.status}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Submitted:</span>
                  <span style={{ color: '#e2e8f0' }}>{reportSuccess.date}</span>
                </div>
              </div>

              <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '24px' }}>Please keep this Report ID for future reference.</p>
              
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                <button onClick={() => setReportSuccess(null)} className="submit-btn" style={{ width: 'auto', padding: '12px 24px', background: '#3b82f6' }}>Submit Another Report</button>
                <button onClick={async () => {
                  try {
                    const res = await fetch(`http://localhost:5000/api/reports/conflict/${reportSuccess.id}`);
                    if (res.ok) {
                      const result = await res.json();
                      setViewReportData(result.data);
                      setActiveMenu('view-report');
                    } else {
                      alert("Failed to fetch report details");
                    }
                  } catch (err) {
                    alert("Error: " + err.message);
                  }
                }} className="submit-btn" style={{ width: 'auto', padding: '12px 24px', background: 'transparent', border: '1px solid #3b82f6', color: '#3b82f6' }}>View Report Details</button>
              </div>
            </div>
          )}

          {activeMenu === 'view-report' && viewReportData && (
            <div className="dashboard-card-full" style={{ position: 'relative', zIndex: 10 }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2>Report Details</h2>
                  <p>Status and information for {viewReportData.report_code}</p>
                </div>
                <div style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', fontWeight: 'bold' }}>
                  {viewReportData.status}
                </div>
              </div>
              
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '24px', borderRadius: '12px', marginTop: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <p style={{ margin: 0, color: '#94a3b8' }}>Report ID: <span style={{ color: '#e2e8f0' }}>{viewReportData.report_code}</span></p>
                  <p style={{ margin: 0, color: '#94a3b8' }}>Incident: <span style={{ color: '#e2e8f0' }}>{viewReportData.incident_type}</span></p>
                  <p style={{ margin: 0, color: '#94a3b8' }}>Location: <span style={{ color: '#e2e8f0' }}>{viewReportData.area} — {viewReportData.landmark}</span></p>
                  <p style={{ margin: 0, color: '#94a3b8' }}>Submitted: <span style={{ color: '#e2e8f0' }}>{new Date(viewReportData.incident_datetime).toLocaleString()}</span></p>
                  <p style={{ margin: 0, color: '#94a3b8' }}>Current status: <span style={{ color: '#e2e8f0', fontWeight: 'bold' }}>{viewReportData.status}</span></p>
                  <p style={{ margin: 0, color: '#94a3b8' }}>Priority: <span style={{ color: '#e2e8f0' }}>{viewReportData.priority || 'Awaiting officer review'}</span></p>
                  <p style={{ margin: 0, color: '#94a3b8' }}>Last updated: <span style={{ color: '#e2e8f0' }}>{new Date(viewReportData.created_at).toLocaleString()}</span></p>
                </div>
              </div>

              {/* Timeline */}
              <div style={{ margin: '32px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                {['Report Submitted', 'Under Review', 'Ranger Assigned', 'Ranger Responding', 'Resolved', 'Closed'].map((step, index) => {
                  const statuses = ['NEW', 'UNDER_REVIEW', 'RANGER_ASSIGNED', 'RANGER_RESPONDING', 'RESOLVED', 'CLOSED'];
                  const currentIndex = statuses.indexOf(viewReportData.status === 'PENDING_INFORMATION' ? 'NEW' : viewReportData.status);
                  const isCompleted = index <= currentIndex;
                  return (
                    <div key={step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
                      <div style={{ 
                        width: '32px', height: '32px', borderRadius: '50%', 
                        background: isCompleted ? '#10b981' : 'rgba(255,255,255,0.1)', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: isCompleted ? '#fff' : '#94a3b8', fontWeight: 'bold', marginBottom: '8px'
                      }}>
                        {isCompleted ? '✓' : '○'}
                      </div>
                      <span style={{ fontSize: '0.8rem', color: isCompleted ? '#10b981' : '#94a3b8', textAlign: 'center', maxWidth: '80px' }}>{step}</span>
                    </div>
                  );
                })}
                {/* Connecting Line */}
                <div style={{ position: 'absolute', top: '16px', left: '20px', right: '20px', height: '2px', background: 'rgba(255,255,255,0.1)', zIndex: 0 }} />
                <div style={{ 
                  position: 'absolute', top: '16px', left: '20px', height: '2px', background: '#10b981', zIndex: 0,
                  width: `${Math.max(0, (['NEW', 'UNDER_REVIEW', 'RANGER_ASSIGNED', 'RANGER_RESPONDING', 'RESOLVED', 'CLOSED'].indexOf(viewReportData.status === 'PENDING_INFORMATION' ? 'NEW' : viewReportData.status)) / 5 * 100)}%`
                }} />
              </div>

              {/* Clarification Request UI */}
              {viewReportData.status === 'PENDING_INFORMATION' && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', padding: '20px', borderRadius: '12px', marginBottom: '24px' }}>
                  <h3 style={{ color: '#ef4444', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldAlert size={20} /> More information needed
                  </h3>
                  <p style={{ color: '#e2e8f0', marginBottom: '16px' }}>
                    A Community Liaison Officer has requested clarification: <strong>"Please confirm the nearest landmark or send a more accurate location."</strong>
                  </p>
                  
                  <div style={{ marginTop: '16px' }}>
                    <textarea 
                      placeholder="Type your clarification here..."
                      value={clarificationText}
                      onChange={e => setClarificationText(e.target.value)}
                      style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', marginBottom: '12px', minHeight: '80px', fontFamily: 'inherit' }}
                    />
                    <label style={{ display: 'block', marginBottom: '16px', color: '#e2e8f0', fontSize: '0.9rem' }}>
                      Attach additional evidence (optional):
                      <div style={{ marginTop: '8px' }}>
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={e => setClarificationFile(e.target.files[0])}
                          style={{ color: '#94a3b8' }}
                        />
                      </div>
                    </label>
                    <button className="submit-btn" disabled={submittingClarification} style={{ width: 'auto', padding: '10px 20px', background: submittingClarification ? '#64748b' : '#ef4444' }} onClick={async () => {
                      if (!clarificationText) {
                        alert("Please provide clarification details.");
                        return;
                      }
                      setSubmittingClarification(true);
                      try {
                        let finalEvidenceUrl = null;
                        if (clarificationFile) {
                          const fileExt = clarificationFile.name.split('.').pop();
                          const fileName = `${Date.now()}_${Math.floor(Math.random() * 1000)}.${fileExt}`;
                          const { error } = await supabase.storage.from('evidence').upload(fileName, clarificationFile);
                          if (!error) {
                            const { data: { publicUrl } } = supabase.storage.from('evidence').getPublicUrl(fileName);
                            finalEvidenceUrl = publicUrl;
                          } else {
                            alert("Error uploading image: " + error.message);
                            setSubmittingClarification(false);
                            return;
                          }
                        }

                        const res = await fetch(`http://localhost:5000/api/reports/conflict/${viewReportData.report_code}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ 
                            status: 'NEW', 
                            clarification_id: viewReportData.report_clarifications?.filter(c => !c.user_reply).pop()?.id,
                            clarification_reply: clarificationText,
                            ...(finalEvidenceUrl && { clarification_evidence_url: finalEvidenceUrl })
                          })
                        });
                        
                        if (res.ok) {
                          const result = await res.json();
                          setViewReportData(result.data); // Update with new history from backend
                          alert("Clarification submitted!");
                          setClarificationText('');
                          setClarificationFile(null);
                        } else {
                          alert("Failed to submit clarification.");
                        }
                      } catch (err) {
                        alert("Error: " + err.message);
                      }
                      setSubmittingClarification(false);
                    }}>
                      {submittingClarification ? 'Submitting...' : 'Submit Clarification'}
                    </button>
                  </div>
                </div>
              )}

              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>
                <h3 style={{ color: '#34d399', marginBottom: '16px', fontSize: '1.1rem' }}>Description</h3>
                <p style={{ color: '#e2e8f0', lineHeight: '1.5', margin: 0 }}>{viewReportData.description}</p>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px' }}>
                <h3 style={{ color: '#34d399', marginBottom: '16px', fontSize: '1.1rem' }}>Evidence</h3>
                {viewReportData.evidence_url && !viewReportData.evidence_url.includes('simulated') ? (
                  <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', overflow: 'hidden', maxWidth: '400px' }}>
                    <div style={{ width: '100%', height: '250px', background: '#1e293b' }}>
                      <img 
                        src={viewReportData.evidence_url} 
                        alt="Evidence" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  </div>
                ) : viewReportData.evidence_url && viewReportData.evidence_url.includes('simulated') ? (
                  <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', overflow: 'hidden', maxWidth: '400px' }}>
                    <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.3)', fontSize: '0.8rem', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      {viewReportData.evidence_url.replace('simulated_upload_url_', '')}
                    </div>
                    <div style={{ width: '100%', height: '250px', background: '#1e293b' }}>
                      <img 
                        src={viewReportData.incident_type === 'ELEPHANT_SIGHTING' 
                          ? "https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?q=80&w=400&auto=format&fit=crop" 
                          : "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=400&auto=format&fit=crop"} 
                        alt="Evidence Placeholder" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  </div>
                ) : (
                  <p style={{ color: '#64748b', fontStyle: 'italic', margin: 0 }}>No evidence provided</p>
                )}
              </div>

              {viewReportData.response_assignments && viewReportData.response_assignments.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <h3 style={{ color: '#38bdf8', margin: '0 0 16px 0', fontSize: '1.1rem' }}>Ranger Updates</h3>
                  {viewReportData.response_assignments.map((assignment, idx) => (
                    <div key={assignment.id || idx} style={{ background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '20px', borderRadius: '12px', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.9rem' }}>
                          Assigned Ranger: <span style={{ color: '#e2e8f0', fontWeight: 'bold' }}>{assignment.ranger_email}</span>
                        </p>
                        <span style={{ 
                          padding: '4px 12px', 
                          borderRadius: '20px', 
                          fontSize: '0.8rem', 
                          background: assignment.status === 'PENDING' ? 'rgba(245, 158, 11, 0.2)' : 
                                      assignment.status === 'ACCEPTED' ? 'rgba(16, 185, 129, 0.2)' : 
                                      assignment.status === 'DECLINED' ? 'rgba(239, 68, 68, 0.2)' : 
                                      assignment.status === 'RESPONDING' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.1)',
                          color: assignment.status === 'PENDING' ? '#f59e0b' : 
                                 assignment.status === 'ACCEPTED' ? '#10b981' : 
                                 assignment.status === 'DECLINED' ? '#ef4444' : 
                                 assignment.status === 'RESPONDING' ? '#38bdf8' : '#e2e8f0'
                        }}>
                          {assignment.status}
                        </span>
                      </div>
                      
                      {assignment.outcome && (
                        <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
                          <h4 style={{ color: '#10b981', margin: '0 0 8px 0', fontSize: '1rem' }}>Outcome Recorded</h4>
                          <p style={{ color: '#e2e8f0', margin: '0 0 16px 0', lineHeight: '1.5' }}>{assignment.outcome}</p>
                          
                          {assignment.outcome_image_url && (
                            <div>
                              <p style={{ color: '#94a3b8', margin: '0 0 8px 0', fontSize: '0.9rem' }}>Attached Photo:</p>
                              <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', overflow: 'hidden', maxWidth: '400px' }}>
                                <div style={{ width: '100%', height: '250px', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <img 
                                    src={assignment.outcome_image_url} 
                                    alt="Ranger Outcome Evidence" 
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {viewReportData.report_clarifications && viewReportData.report_clarifications.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <h3 style={{ color: '#34d399', margin: '0 0 16px 0', fontSize: '1.1rem' }}>Clarification History</h3>
                  {viewReportData.report_clarifications.map((clarification, idx) => (
                    <div key={clarification.id || idx} style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '20px', borderRadius: '12px', marginBottom: '16px' }}>
                      <p style={{ color: '#ef4444', margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 'bold' }}>
                        Officer Request ({new Date(clarification.created_at).toLocaleString()}):
                      </p>
                      <p style={{ color: '#e2e8f0', margin: '0 0 16px 0', lineHeight: '1.5' }}>
                        {clarification.officer_request}
                      </p>
                      
                      {clarification.user_reply && (
                        <>
                          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '16px 0' }} />
                          <p style={{ color: '#34d399', margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 'bold' }}>
                            Your Reply:
                          </p>
                          <p style={{ color: '#e2e8f0', margin: '0 0 16px 0', lineHeight: '1.5' }}>
                            {clarification.user_reply}
                          </p>
                          {clarification.evidence_url && (
                            <div>
                              <p style={{ color: '#94a3b8', margin: '0 0 8px 0', fontSize: '0.9rem' }}>Attached Photo:</p>
                              <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', overflow: 'hidden', maxWidth: '400px' }}>
                                <div style={{ width: '100%', height: '250px', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <img 
                                    src={clarification.evidence_url} 
                                    alt="Clarification Evidence" 
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: '24px', display: 'flex', gap: '16px' }}>
                <button onClick={() => { setActiveMenu('dashboard'); setReportSuccess(null); }} className="submit-btn" style={{ width: 'auto', padding: '10px 20px', background: '#3b82f6' }}>Back to Home</button>
              </div>
            </div>
          )}

          {activeMenu === 'track-report' && (
            <div className="dashboard-card-full" style={{ position: 'relative', zIndex: 10 }}>
              <div className="card-header" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <ShieldAlert size={36} color="#3b82f6" />
                  <div>
                    <h2>My Incident Reports</h2>
                    <p>Track the status of your submitted reports.</p>
                  </div>
                </div>
              </div>

              {allReports.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', background: 'rgba(0,0,0,0.1)', borderRadius: '12px' }}>
                  <p>No reports found. You haven't submitted any incident reports yet.</p>
                  <button onClick={() => setActiveMenu('report')} className="submit-btn" style={{ width: 'auto', padding: '10px 20px', marginTop: '16px' }}>Submit a Report</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {allReports.map((report) => (
                    <div key={report.id} style={{ 
                      background: 'rgba(0,0,0,0.2)', 
                      borderRadius: '12px', 
                      padding: '20px', 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                          <h3 style={{ color: '#e2e8f0', margin: 0, fontSize: '1.1rem' }}>{report.report_code}</h3>
                          <span style={{ 
                            padding: '4px 10px', 
                            borderRadius: '20px', 
                            fontSize: '0.8rem', 
                            fontWeight: 'bold',
                            background: report.status === 'NEW' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                            color: report.status === 'NEW' ? '#f59e0b' : '#10b981'
                          }}>
                            {report.status}
                          </span>
                        </div>
                        <p style={{ color: '#94a3b8', margin: '0 0 4px 0', fontSize: '0.9rem' }}>{report.incident_type} • {new Date(report.incident_datetime).toLocaleDateString()}</p>
                        <p style={{ color: '#64748b', margin: 0, fontSize: '0.85rem' }}>{report.area}</p>
                        <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '0.85rem' }}>
                          Priority: {report.priority ? report.priority : 'Pending review'}
                        </p>
                      </div>
                      
                      <button 
                        onClick={() => {
                          setViewReportData(report);
                          setActiveMenu('view-report');
                        }}
                        className="submit-btn" 
                        style={{ width: 'auto', padding: '8px 16px', background: 'transparent', border: '1px solid #3b82f6', color: '#3b82f6' }}
                      >
                        View Details
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeMenu === 'report' && !reportSuccess && (
            <div className="dashboard-card-full" style={{ position: 'relative', zIndex: 10 }}>
              <div className="card-header">
                <h2>Submit Incident Report</h2>
                <p>Report human-elephant conflicts or other wildlife issues. Our officers will review and respond.</p>
              </div>

              <form onSubmit={handleSubmitReport} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* Section 1: Incident Details */}
                <div>
                  <h3 style={{ color: '#34d399', marginBottom: '16px', fontSize: '1.1rem' }}>1. Incident Details</h3>
                  <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '16px' }}>
                    <div className="form-group" style={{ flex: '1 1 200px' }}>
                      <label htmlFor="incidentType">Incident Type <span style={{color: '#ef4444'}}>*</span></label>
                      <select id="incidentType" className="form-input" style={{ paddingLeft: '16px' }} value={formData.incidentType} onChange={handleInputChange} required>
                        <option value="ELEPHANT_SIGHTING">Elephant Sighting</option>
                        <option value="CROP_DAMAGE">Crop Damage</option>
                        <option value="PROPERTY_DAMAGE">Property Damage</option>
                        <option value="INJURED_ANIMAL">Injured Animal</option>
                        <option value="HUMAN_INJURY">Human Injury</option>
                        <option value="OTHER">Other wildlife conflict</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ flex: '1 1 200px' }}>
                      <label htmlFor="incidentDate">Incident Date & Time <span style={{color: '#ef4444'}}>*</span></label>
                      <input type="datetime-local" id="incidentDate" className="form-input" style={{ paddingLeft: '16px' }} value={formData.incidentDate} onChange={handleInputChange} required />
                    </div>
                  </div>

                  {formData.incidentType === 'OTHER' && (
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                      <label htmlFor="otherIncidentType">Please specify the incident type <span style={{color: '#ef4444'}}>*</span></label>
                      <input 
                        type="text" 
                        id="otherIncidentType" 
                        className="form-input" 
                        style={{ paddingLeft: '16px' }} 
                        placeholder="e.g. Poaching activity, Wildfire" 
                        value={formData.otherIncidentType} 
                        onChange={handleInputChange} 
                        required={formData.incidentType === 'OTHER'} 
                      />
                    </div>
                  )}

                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <label htmlFor="description">What happened? <span style={{color: '#ef4444'}}>*</span></label>
                      <span style={{ fontSize: '0.8rem', color: formData.description.length > 500 ? '#ef4444' : '#94a3b8' }}>
                        {formData.description.length} / 500 characters
                      </span>
                    </div>
                    <textarea 
                      id="description" 
                      className="form-input" 
                      style={{ padding: '16px', minHeight: '100px', resize: 'vertical' }} 
                      placeholder="Please describe the situation briefly (min 15 characters)..." 
                      value={formData.description} 
                      onChange={handleInputChange} 
                      maxLength={500}
                      required
                    ></textarea>
                  </div>

                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '16px', borderRadius: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fca5a5', cursor: 'pointer', fontWeight: 600 }}>
                      <input type="checkbox" id="ongoingRisk" checked={formData.ongoingRisk} onChange={handleInputChange} style={{ width: '20px', height: '20px', accentColor: '#ef4444' }} />
                      Immediate danger or injury is occurring now
                    </label>
                    <p style={{ fontSize: '0.85rem', color: '#f87171', margin: '8px 0 0 30px' }}>If anyone is in immediate danger, contact emergency services first.</p>
                  </div>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)' }} />

                {/* Section 2: Location Details */}
                <div>
                  <h3 style={{ color: '#34d399', marginBottom: '16px', fontSize: '1.1rem' }}>2. Location Details</h3>
                  <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '16px' }}>
                    <div className="form-group" style={{ flex: '1 1 200px' }}>
                      <label htmlFor="area">Area / Village <span style={{color: '#ef4444'}}>*</span></label>
                      <input type="text" id="area" className="form-input" style={{ paddingLeft: '16px' }} placeholder="e.g. Yala, Kataragama" value={formData.area} onChange={handleInputChange} required />
                    </div>

                    <div className="form-group" style={{ flex: '2 1 300px' }}>
                      <label htmlFor="landmark">Specific Landmark / Directions <span style={{color: '#ef4444'}}>*</span></label>
                      <input type="text" id="landmark" className="form-input" style={{ paddingLeft: '16px' }} placeholder="e.g. Near the big banyan tree by the lake" value={formData.landmark} onChange={handleInputChange} required />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Current Location (Optional)</label>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <button 
                        type="button" 
                        className="submit-btn" 
                        style={{ width: 'auto', padding: '10px 20px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid #38bdf8', color: '#38bdf8' }}
                        onClick={() => {
                          if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(
                              (pos) => setFormData({...formData, gpsCoordinates: `${pos.coords.latitude}, ${pos.coords.longitude}`}),
                              () => alert('We could not access your location. Please ensure you entered a landmark/directions.')
                            );
                          }
                        }}
                      >
                        <MapPin size={18} style={{ marginRight: '8px' }} /> Get Location
                      </button>
                      
                      {formData.gpsCoordinates && (
                        <div style={{ color: '#34d399', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          ✓ Location Captured ({formData.gpsCoordinates})
                        </div>
                      )}
                    </div>
                    <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '6px' }}>Helps rangers find the exact spot quickly.</p>
                  </div>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)' }} />

                {/* Section 3: Contact */}
                <div>
                  <h3 style={{ color: '#34d399', marginBottom: '16px', fontSize: '1.1rem' }}>3. Contact & Evidence</h3>
                  
                  <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '16px' }}>
                    <div className="form-group" style={{ flex: '1 1 200px' }}>
                      <label htmlFor="reporterName">Full Name <span style={{color: '#ef4444'}}>*</span></label>
                      <input type="text" id="reporterName" className="form-input" style={{ paddingLeft: '16px' }} placeholder="e.g. Nimal Perera" value={formData.reporterName} onChange={handleInputChange} required />
                    </div>

                    <div className="form-group" style={{ flex: '1 1 200px' }}>
                      <label htmlFor="contactNumber">Contact Number <span style={{color: '#ef4444'}}>*</span></label>
                      <input type="tel" id="contactNumber" className="form-input" style={{ paddingLeft: '16px' }} placeholder="07XXXXXXXX" value={formData.contactNumber} onChange={handleInputChange} required />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '24px' }}>
                    <label>Preferred Contact Method <span style={{color: '#ef4444'}}>*</span></label>
                    <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e2e8f0', cursor: 'pointer' }}>
                        <input type="radio" name="contactMethod" value="PHONE" checked={formData.contactMethod === 'PHONE'} onChange={handleContactMethodChange} style={{ accentColor: '#14b8a6', width: '16px', height: '16px' }} />
                        Phone Call
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e2e8f0', cursor: 'pointer' }}>
                        <input type="radio" name="contactMethod" value="SMS_WHATSAPP" checked={formData.contactMethod === 'SMS_WHATSAPP'} onChange={handleContactMethodChange} style={{ accentColor: '#14b8a6', width: '16px', height: '16px' }} />
                        SMS / WhatsApp
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e2e8f0', cursor: 'pointer' }}>
                        <input type="radio" name="contactMethod" value="EMAIL" checked={formData.contactMethod === 'EMAIL'} onChange={handleContactMethodChange} style={{ accentColor: '#14b8a6', width: '16px', height: '16px' }} />
                        Email
                      </label>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Evidence (Photo) <span style={{color: '#ef4444'}}>*</span></label>
                    <input 
                      type="file" 
                      id="evidenceUpload" 
                      accept="image/*" 
                      style={{ display: 'none' }} 
                      onChange={handleFileChange}
                    />
                    <label 
                      htmlFor="evidenceUpload"
                      style={{ 
                        border: formData.evidenceFile ? '2px solid #10b981' : '2px dashed rgba(255,255,255,0.2)', 
                        borderRadius: '8px', padding: '20px', textAlign: 'center', cursor: 'pointer', 
                        background: formData.evidenceFile ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0,0,0,0.1)',
                        display: 'block'
                      }}
                    >
                      <Camera size={24} color={formData.evidenceFile ? '#10b981' : '#94a3b8'} style={{ marginBottom: '8px' }} />
                      <p style={{ margin: 0, color: formData.evidenceFile ? '#10b981' : '#e2e8f0', fontSize: '0.9rem' }}>
                        {formData.evidenceFile ? `✓ ${formData.evidenceFile.name}` : 'Click to upload a photo'}
                      </p>
                      {!formData.evidenceFile && <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.8rem' }}>JPG, PNG — Max 5 MB</p>}
                    </label>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', marginTop: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                    <input type="checkbox" id="consentGiven" checked={formData.consentGiven} onChange={handleInputChange} style={{ width: '18px', height: '18px', accentColor: '#10b981', marginTop: '2px' }} required />
                    <div>
                      <span style={{ color: '#e2e8f0', fontWeight: 500 }}>I confirm that the information is accurate to the best of my knowledge. <span style={{color: '#ef4444'}}>*</span></span>
                      <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '4px 0 0 0' }}>Your contact details will only be used by wildlife officers to clarify or coordinate this report.</p>
                    </div>
                  </label>
                </div>

                <button type="submit" className="submit-btn" disabled={loading || !formData.consentGiven} style={{ marginTop: '16px', padding: '16px', fontSize: '1.1rem', opacity: (!formData.consentGiven || loading) ? 0.6 : 1 }}>
                  {loading ? 'Submitting Report...' : 'Submit Incident Report'}
                </button>
              </form>
            </div>
          )}

          {activeMenu !== 'dashboard' && activeMenu !== 'report' && activeMenu !== 'track-report' && activeMenu !== 'view-report' && (
            <div className="dashboard-card-full" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', color: '#94a3b8', position: 'relative', zIndex: 10 }}>
              <h3>This module is under construction.</h3>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
