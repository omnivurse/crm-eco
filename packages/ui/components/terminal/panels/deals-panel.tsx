// Deals Panel - Starship Command Center
import React from 'react';

interface Deal {
  id: string;
  name: string;
  value: number;
  stage: string;
  probability: number;
  closeDate?: string;
  isHot?: boolean;
  isAtRisk?: boolean;
}

interface DealsPanelProps {
  data?: {
    deals?: Deal[];
    filter?: string;
    summary?: {
      totalValue: number;
      totalDeals: number;
      avgProbability: number;
    };
  };
}

// Mock data for demonstration
const mockDeals: Deal[] = [
  { id: '1', name: 'Enterprise License - Acme Corp', value: 125000, stage: 'Negotiation', probability: 75, closeDate: '2024-02-15', isHot: true },
  { id: '2', name: 'Cloud Migration - TechStart', value: 85000, stage: 'Proposal', probability: 60, closeDate: '2024-02-28' },
  { id: '3', name: 'Support Contract - GlobalCo', value: 45000, stage: 'Discovery', probability: 40, isAtRisk: true },
  { id: '4', name: 'Platform Upgrade - MegaCorp', value: 200000, stage: 'Qualification', probability: 25, closeDate: '2024-03-15', isHot: true },
  { id: '5', name: 'Security Suite - FinanceHub', value: 95000, stage: 'Negotiation', probability: 80, closeDate: '2024-02-10' },
];

export function DealsPanel({ data }: DealsPanelProps) {
  const filter = data?.filter;
  let displayDeals = data?.deals || mockDeals;

  // Apply filters
  if (filter === 'hot') {
    displayDeals = displayDeals.filter(d => d.isHot);
  } else if (filter === 'at-risk') {
    displayDeals = displayDeals.filter(d => d.isAtRisk);
  }

  const totalValue = displayDeals.reduce((sum, d) => sum + d.value, 0);
  const avgProbability = displayDeals.length > 0
    ? Math.round(displayDeals.reduce((sum, d) => sum + d.probability, 0) / displayDeals.length)
    : 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      'Qualification': 'stage-qualification',
      'Discovery': 'stage-discovery',
      'Proposal': 'stage-proposal',
      'Negotiation': 'stage-negotiation',
      'Closed Won': 'stage-won',
      'Closed Lost': 'stage-lost',
    };
    return colors[stage] || 'stage-default';
  };

  return (
    <div className="terminal-panel deals-panel">
      <div className="panel-header">
        <span className="panel-icon">💼</span>
        <span className="panel-title">
          {filter === 'hot' ? 'HOT DEALS' : filter === 'at-risk' ? 'AT-RISK DEALS' : 'DEALS PIPELINE'}
        </span>
        <span className="panel-count">{displayDeals.length} deals</span>
      </div>

      <div className="panel-content">
        {/* Summary Stats */}
        <div className="deals-summary">
          <div className="summary-item">
            <span className="summary-label">Total Value</span>
            <span className="summary-value">{formatCurrency(totalValue)}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Avg Probability</span>
            <span className="summary-value">{avgProbability}%</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Weighted Value</span>
            <span className="summary-value">{formatCurrency(totalValue * (avgProbability / 100))}</span>
          </div>
        </div>

        {/* Deals List */}
        <div className="deals-list">
          <div className="section-title">◈ ACTIVE DEALS</div>
          <table className="terminal-table">
            <thead>
              <tr>
                <th>Deal</th>
                <th>Value</th>
                <th>Stage</th>
                <th>Prob</th>
                <th>Close</th>
              </tr>
            </thead>
            <tbody>
              {displayDeals.map(deal => (
                <tr key={deal.id} className={`${deal.isHot ? 'row-hot' : ''} ${deal.isAtRisk ? 'row-risk' : ''}`}>
                  <td className="deal-name">
                    {deal.isHot && <span className="indicator hot">🔥</span>}
                    {deal.isAtRisk && <span className="indicator risk">⚠</span>}
                    {deal.name}
                  </td>
                  <td className="deal-value">{formatCurrency(deal.value)}</td>
                  <td className={`deal-stage ${getStageColor(deal.stage)}`}>{deal.stage}</td>
                  <td className="deal-prob">{deal.probability}%</td>
                  <td className="deal-close">{deal.closeDate || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel-footer">
        <span className="footer-hint">Type <code>deals hot</code> for hot deals, <code>at-risk</code> for at-risk</span>
      </div>
    </div>
  );
}
