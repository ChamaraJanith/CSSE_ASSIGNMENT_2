import React, { useState } from 'react';
import { apiService } from '../../services/api';

const FiledReportsModule = () => {
  const [reports, setReports] = useState([]);
  const [filter, setFilter] = useState('ALL');
  
  React.useEffect(() => {
    const loadReports = async () => {
      try {
        const res = await apiService.getAllReports();
        setReports(res.data || []);
      } catch (err) {
        console.error("Failed to load filed reports", err);
      }
    };
    loadReports();
  }, []);

  const filteredReports = reports.filter(r => filter === 'ALL' || r.status === filter);

  return (
    <div className="dashboard-card-full" style={{ position: 'relative', zIndex: 10 }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2>Filed Reports Archive</h2>
          <p>View historical data of all community-submitted conflict reports.</p>
        </div>
        <select 
          value={filter} 
          onChange={e => setFilter(e.target.value)}
          style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px' }}
        >
          <option style={{color: 'black'}} value="ALL">All Statuses</option>
          <option style={{color: 'black'}} value="NEW">New</option>
          <option style={{color: 'black'}} value="UNDER_REVIEW">Under Review</option>
          <option style={{color: 'black'}} value="RANGER_ASSIGNED">Ranger Assigned</option>
          <option style={{color: 'black'}} value="RESOLVED">Resolved</option>
        </select>
      </div>

      <div style={{ overflowX: 'auto', marginTop: '20px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: '#e2e8f0' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
              <th style={{ padding: '12px', fontWeight: 500 }}>Date</th>
              <th style={{ padding: '12px', fontWeight: 500 }}>Report ID</th>
              <th style={{ padding: '12px', fontWeight: 500 }}>Reporter</th>
              <th style={{ padding: '12px', fontWeight: 500 }}>Incident Type</th>
              <th style={{ padding: '12px', fontWeight: 500 }}>Area</th>
              <th style={{ padding: '12px', fontWeight: 500 }}>Risk</th>
              <th style={{ padding: '12px', fontWeight: 500 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredReports.map(report => (
              <tr key={report.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '12px' }}>{new Date(report.incident_datetime).toLocaleDateString()}</td>
                <td style={{ padding: '12px' }}>{report.report_code}</td>
                <td style={{ padding: '12px' }}>{report.reporter_name}</td>
                <td style={{ padding: '12px' }}>{report.incident_type}</td>
                <td style={{ padding: '12px' }}>{report.area}</td>
                <td style={{ padding: '12px', color: report.immediate_risk ? '#ef4444' : '#94a3b8' }}>
                  {report.immediate_risk ? 'HIGH' : 'Normal'}
                </td>
                <td style={{ padding: '12px' }}>
                  <span style={{ 
                    padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold',
                    background: report.status === 'RESOLVED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.1)',
                    color: report.status === 'RESOLVED' ? '#10b981' : '#e2e8f0'
                  }}>
                    {report.status}
                  </span>
                </td>
              </tr>
            ))}
            {filteredReports.length === 0 && (
              <tr><td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No reports match the selected filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FiledReportsModule;
