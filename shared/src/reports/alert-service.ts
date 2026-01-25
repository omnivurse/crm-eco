import type {
  ReportAlert,
  AlertConditionType,
  AlertConditionConfig,
} from './types.js';

// ============================================================================
// ALERT EVALUATION TYPES
// ============================================================================

export interface AlertEvaluationResult {
  alertId: string;
  triggered: boolean;
  message: string;
  currentValue?: number;
  thresholdValue?: number;
  conditionType: AlertConditionType;
  timestamp: string;
}

export interface AlertNotification {
  alertId: string;
  alertName: string;
  recipients: string[];
  subject: string;
  body: string;
  priority: 'low' | 'medium' | 'high';
  metadata: Record<string, unknown>;
}

// ============================================================================
// ALERT EVALUATION FUNCTIONS
// ============================================================================

/**
 * Evaluate a threshold alert condition
 */
export function evaluateThresholdCondition(
  config: { metric: string; operator: string; value: number },
  currentValue: number
): boolean {
  const { operator, value: threshold } = config;

  switch (operator) {
    case 'gt':
      return currentValue > threshold;
    case 'gte':
      return currentValue >= threshold;
    case 'lt':
      return currentValue < threshold;
    case 'lte':
      return currentValue <= threshold;
    case 'eq':
      return currentValue === threshold;
    default:
      return false;
  }
}

/**
 * Evaluate a change-based alert condition
 */
export function evaluateChangeCondition(
  config: { changeType: string; changePercent?: number; changeValue?: number },
  previousValue: number,
  currentValue: number
): boolean {
  const { changeType, changePercent, changeValue } = config;

  const actualChange = currentValue - previousValue;
  const percentChange = previousValue !== 0
    ? ((currentValue - previousValue) / previousValue) * 100
    : currentValue !== 0 ? 100 : 0;

  // Check direction
  if (changeType === 'increase' && actualChange <= 0) return false;
  if (changeType === 'decrease' && actualChange >= 0) return false;

  // Check threshold
  if (changePercent !== undefined) {
    return Math.abs(percentChange) >= changePercent;
  }
  if (changeValue !== undefined) {
    return Math.abs(actualChange) >= changeValue;
  }

  // If no threshold specified, any change triggers
  return actualChange !== 0;
}

/**
 * Evaluate an alert against report data
 */
export function evaluateAlert(
  alert: ReportAlert,
  reportData: Record<string, unknown>[],
  previousData?: Record<string, unknown>[]
): AlertEvaluationResult {
  const config = alert.conditionConfig as AlertConditionConfig;
  const timestamp = new Date().toISOString();

  switch (alert.conditionType) {
    case 'threshold': {
      const thresholdConfig = config as { metric: string; operator: string; value: number };

      // Calculate metric from report data
      const metricValue = calculateMetricFromData(thresholdConfig.metric, reportData);
      const triggered = evaluateThresholdCondition(thresholdConfig, metricValue);

      return {
        alertId: alert.id || '',
        triggered,
        message: triggered
          ? `Alert triggered: ${thresholdConfig.metric} is ${getOperatorText(thresholdConfig.operator)} ${thresholdConfig.value} (current: ${metricValue})`
          : `Alert not triggered: ${thresholdConfig.metric} = ${metricValue}`,
        currentValue: metricValue,
        thresholdValue: thresholdConfig.value,
        conditionType: 'threshold',
        timestamp,
      };
    }

    case 'change': {
      const changeConfig = config as { metric: string; changeType: string; changePercent?: number; changeValue?: number };

      if (!previousData) {
        return {
          alertId: alert.id || '',
          triggered: false,
          message: 'No previous data available for change comparison',
          conditionType: 'change',
          timestamp,
        };
      }

      const currentValue = calculateMetricFromData(changeConfig.metric, reportData);
      const previousValue = calculateMetricFromData(changeConfig.metric, previousData);
      const triggered = evaluateChangeCondition(changeConfig, previousValue, currentValue);

      return {
        alertId: alert.id || '',
        triggered,
        message: triggered
          ? `Alert triggered: ${changeConfig.metric} changed from ${previousValue} to ${currentValue}`
          : `No significant change in ${changeConfig.metric}`,
        currentValue,
        thresholdValue: changeConfig.changeValue || changeConfig.changePercent,
        conditionType: 'change',
        timestamp,
      };
    }

    case 'milestone': {
      // Milestone alerts are handled separately by the milestone service
      return {
        alertId: alert.id || '',
        triggered: false,
        message: 'Milestone alerts are evaluated separately',
        conditionType: 'milestone',
        timestamp,
      };
    }

    default:
      return {
        alertId: alert.id || '',
        triggered: false,
        message: `Unknown condition type: ${alert.conditionType}`,
        conditionType: alert.conditionType,
        timestamp,
      };
  }
}

/**
 * Calculate a metric value from report data
 */
function calculateMetricFromData(
  metric: string,
  data: Record<string, unknown>[]
): number {
  if (!data || data.length === 0) return 0;

  // Handle count metrics
  if (metric === 'count' || metric === 'total_count') {
    return data.length;
  }

  // Handle aggregation metrics
  if (metric.startsWith('sum_')) {
    const field = metric.replace('sum_', '');
    return data.reduce((sum, row) => sum + (Number(row[field]) || 0), 0);
  }

  if (metric.startsWith('avg_')) {
    const field = metric.replace('avg_', '');
    const sum = data.reduce((s, row) => s + (Number(row[field]) || 0), 0);
    return data.length > 0 ? sum / data.length : 0;
  }

  if (metric.startsWith('max_')) {
    const field = metric.replace('max_', '');
    return Math.max(...data.map((row) => Number(row[field]) || 0));
  }

  if (metric.startsWith('min_')) {
    const field = metric.replace('min_', '');
    return Math.min(...data.map((row) => Number(row[field]) || 0));
  }

  // Check if it's a direct field
  const firstRow = data[0];
  if (firstRow && metric in firstRow) {
    return Number(firstRow[metric]) || 0;
  }

  return 0;
}

/**
 * Get human-readable operator text
 */
function getOperatorText(operator: string): string {
  const operatorText: Record<string, string> = {
    gt: 'greater than',
    gte: 'greater than or equal to',
    lt: 'less than',
    lte: 'less than or equal to',
    eq: 'equal to',
  };
  return operatorText[operator] || operator;
}

/**
 * Create an alert notification
 */
export function createAlertNotification(
  alert: ReportAlert,
  result: AlertEvaluationResult
): AlertNotification | null {
  if (!result.triggered) return null;

  const priority = determineAlertPriority(result);

  return {
    alertId: alert.id || '',
    alertName: alert.name,
    recipients: alert.recipients,
    subject: `Alert: ${alert.name}`,
    body: result.message,
    priority,
    metadata: {
      conditionType: result.conditionType,
      currentValue: result.currentValue,
      thresholdValue: result.thresholdValue,
      timestamp: result.timestamp,
    },
  };
}

/**
 * Determine alert priority based on result
 */
function determineAlertPriority(
  result: AlertEvaluationResult
): 'low' | 'medium' | 'high' {
  if (!result.currentValue || !result.thresholdValue) return 'medium';

  const ratio = result.currentValue / result.thresholdValue;

  // If current value significantly exceeds threshold
  if (ratio > 2) return 'high';
  if (ratio > 1.5) return 'medium';
  return 'low';
}

/**
 * Batch evaluate multiple alerts
 */
export function evaluateAlerts(
  alerts: ReportAlert[],
  reportData: Record<string, unknown>[],
  previousData?: Record<string, unknown>[]
): AlertEvaluationResult[] {
  return alerts
    .filter((alert) => alert.isEnabled)
    .map((alert) => evaluateAlert(alert, reportData, previousData));
}

/**
 * Filter triggered alerts
 */
export function getTriggeredAlerts(
  results: AlertEvaluationResult[]
): AlertEvaluationResult[] {
  return results.filter((result) => result.triggered);
}
