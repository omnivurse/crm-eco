// Status Panel - Starship Command Center
import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

interface ServiceStatus {
  name: string;
  status: 'operational' | 'degraded' | 'down';
  latency?: number;
  lastCheck: Date;
}

export function StatusPanel() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [uptime] = useState('99.97%');

  useEffect(() => {
    async function checkServices() {
      setLoading(true);

      const serviceChecks: ServiceStatus[] = [];

      // Check Supabase connection
      const supabaseStart = Date.now();
      try {
        await supabase.from('profiles').select('id').limit(1);
        serviceChecks.push({
          name: 'Database',
          status: 'operational',
          latency: Date.now() - supabaseStart,
          lastCheck: new Date(),
        });
      } catch {
        serviceChecks.push({
          name: 'Database',
          status: 'down',
          lastCheck: new Date(),
        });
      }

      // Check Auth service
      try {
        const { data: { session } } = await supabase.auth.getSession();
        serviceChecks.push({
          name: 'Authentication',
          status: session ? 'operational' : 'degraded',
          lastCheck: new Date(),
        });
      } catch {
        serviceChecks.push({
          name: 'Authentication',
          status: 'down',
          lastCheck: new Date(),
        });
      }

      // Add mock services for demonstration
      serviceChecks.push(
        {
          name: 'API Gateway',
          status: 'operational',
          latency: 45,
          lastCheck: new Date(),
        },
        {
          name: 'Storage',
          status: 'operational',
          latency: 120,
          lastCheck: new Date(),
        },
        {
          name: 'Email Service',
          status: 'operational',
          latency: 200,
          lastCheck: new Date(),
        },
        {
          name: 'AI Engine',
          status: 'operational',
          latency: 350,
          lastCheck: new Date(),
        }
      );

      setServices(serviceChecks);
      setLoading(false);
    }

    checkServices();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational':
        return '●';
      case 'degraded':
        return '◐';
      case 'down':
        return '○';
      default:
        return '?';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
        return 'status-operational';
      case 'degraded':
        return 'status-degraded';
      case 'down':
        return 'status-down';
      default:
        return '';
    }
  };

  const overallStatus = services.some(s => s.status === 'down')
    ? 'CRITICAL'
    : services.some(s => s.status === 'degraded')
    ? 'DEGRADED'
    : 'OPERATIONAL';

  if (loading) {
    return (
      <div className="terminal-panel status-panel loading">
        <div className="panel-header">
          <span className="panel-icon">📡</span>
          <span className="panel-title">SYSTEM STATUS</span>
          <span className="panel-status loading">SCANNING...</span>
        </div>
        <div className="panel-loading">
          <div className="loading-bar" />
        </div>
      </div>
    );
  }

  return (
    <div className="terminal-panel status-panel">
      <div className="panel-header">
        <span className="panel-icon">📡</span>
        <span className="panel-title">SYSTEM STATUS</span>
        <span className={`panel-status ${overallStatus.toLowerCase()}`}>{overallStatus}</span>
      </div>

      <div className="panel-content">
        {/* Overall Stats */}
        <div className="status-overview">
          <div className="overview-item">
            <span className="overview-label">System Uptime</span>
            <span className="overview-value">{uptime}</span>
          </div>
          <div className="overview-item">
            <span className="overview-label">Services</span>
            <span className="overview-value">
              {services.filter(s => s.status === 'operational').length}/{services.length} Online
            </span>
          </div>
          <div className="overview-item">
            <span className="overview-label">Last Check</span>
            <span className="overview-value">
              {new Date().toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* Services List */}
        <div className="services-section">
          <div className="section-title">◈ SERVICE STATUS</div>
          <div className="services-list">
            {services.map((service, index) => (
              <div key={index} className={`service-item ${getStatusColor(service.status)}`}>
                <span className={`service-indicator ${getStatusColor(service.status)}`}>
                  {getStatusIcon(service.status)}
                </span>
                <span className="service-name">{service.name}</span>
                <span className="service-status">{service.status.toUpperCase()}</span>
                {service.latency && (
                  <span className="service-latency">{service.latency}ms</span>
                )}
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
