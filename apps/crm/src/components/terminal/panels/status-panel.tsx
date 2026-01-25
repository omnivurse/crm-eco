'use client';

// Status Panel - Starship Command Center
import React from 'react';

export function StatusPanel() {
  const services = [
    { name: 'Database', status: 'operational', latency: 45 },
    { name: 'API Gateway', status: 'operational', latency: 32 },
    { name: 'Authentication', status: 'operational', latency: 28 },
    { name: 'Email Service', status: 'operational', latency: 120 },
    { name: 'Storage', status: 'operational', latency: 85 },
  ];

  return (
    <div className="terminal-panel status-panel">
      <div className="panel-header">
        <span className="panel-icon">📡</span>
        <span className="panel-title">SYSTEM STATUS</span>
        <span className="panel-status operational">OPERATIONAL</span>
      </div>

      <div className="panel-content">
        <div className="status-overview">
          <div className="overview-item">
            <span className="overview-label">System Uptime</span>
            <span className="overview-value">99.97%</span>
          </div>
          <div className="overview-item">
            <span className="overview-label">Services</span>
            <span className="overview-value">{services.length}/{services.length} Online</span>
          </div>
          <div className="overview-item">
            <span className="overview-label">Last Check</span>
            <span className="overview-value">{new Date().toLocaleTimeString()}</span>
          </div>
        </div>

        <div className="services-section">
          <div className="section-title">◈ SERVICE STATUS</div>
          <div className="services-list">
            {services.map((service, index) => (
              <div key={index} className="service-item status-operational">
                <span className="service-indicator status-operational">●</span>
                <span className="service-name">{service.name}</span>
                <span className="service-status">OPERATIONAL</span>
                <span className="service-latency">{service.latency}ms</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel-footer">
        <span className="footer-text">All systems monitored in real-time</span>
      </div>
    </div>
  );
}
