'use client';

// Deals Panel - Starship Command Center
import React from 'react';

interface DealsPanelProps {
  data?: {
    filter?: string;
  };
}

const mockDeals = [
  { id: '1', name: 'Enterprise License - Acme Corp', value: 125000, stage: 'Negotiation', probability: 75, isHot: true },
  { id: '2', name: 'Cloud Migration - TechStart', value: 85000, stage: 'Proposal', probability: 60 },
  { id: '3', name: 'Support Contract - GlobalCo', value: 45000, stage: 'Discovery', probability: 40, isAtRisk: true },
  { id: '4', name: 'Platform Upgrade - MegaCorp', value: 200000, stage: 'Qualification', probability: 25, isHot: true },
];

export function DealsPanel({ data }: DealsPanelProps) {
  const filter = data?.filter;
  let displayDeals = mockDeals;

  if (filter === 'hot') {
    displayDeals = displayDeals.filter(d => d.isHot);
  } else if (filter === 'at-risk') {
    displayDeals = displayDeals.filter(d => d.isAtRisk);
  }

  const totalValue = displayDeals.reduce((sum, d) => sum + d.value, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);
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
        <div className="deals-summary">
          <div className="summary-item">
            <span className="summary-label">Total Value</span>
            <span className="summary-value">{formatCurrency(totalValue)}</span>
          </div>
        </div>

        <div className="deals-list">
          <div className="section-title">◈ ACTIVE DEALS</div>
          <table className="terminal-table">
            <thead>
              <tr>
                <th>Deal</th>
                <th>Value</th>
                <th>Stage</th>
                <th>Prob</th>
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
                  <td className="deal-stage">{deal.stage}</td>
                  <td className="deal-prob">{deal.probability}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
