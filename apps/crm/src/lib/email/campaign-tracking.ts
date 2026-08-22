const HREF_RE = /href=(["'])(https?:\/\/[^"']+)\1/gi;

export function campaignTrackingId(campaignId: string, recipientId: string): string {
  return `${campaignId}_${recipientId}`;
}

export function injectCampaignTracking(
  html: string,
  origin: string,
  trackingId: string,
): string {
  const base = origin.replace(/\/$/, '');
  const openUrl = `${base}/api/tracking/open/${encodeURIComponent(trackingId)}`;
  const clickBase = `${base}/api/tracking/click/${encodeURIComponent(trackingId)}`;

  const withClicks = html.replace(HREF_RE, (_match, quote: string, url: string) => {
    if (url.includes('/api/tracking/')) {
      return `href=${quote}${url}${quote}`;
    }
    const wrapped = `${clickBase}?url=${encodeURIComponent(url)}`;
    return `href=${quote}${wrapped}${quote}`;
  });

  const pixel = `<img src="${openUrl}" width="1" height="1" alt="" style="display:none;border:0;" />`;
  if (/<\/body>/i.test(withClicks)) {
    return withClicks.replace(/<\/body>/i, `${pixel}</body>`);
  }
  return `${withClicks}${pixel}`;
}
