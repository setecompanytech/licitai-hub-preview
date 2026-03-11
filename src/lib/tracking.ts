// UTM & Pixel tracking utilities

export interface UtmParams {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  referrer: string;
}

export function getUtmParams(): UtmParams {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    utm_term: params.get('utm_term'),
    utm_content: params.get('utm_content'),
    referrer: document.referrer || '',
  };
}

export function storeUtmParams() {
  const utm = getUtmParams();
  if (utm.utm_source || utm.utm_medium || utm.utm_campaign) {
    sessionStorage.setItem('praefectus_utm', JSON.stringify(utm));
  }
}

export function getStoredUtm(): UtmParams {
  try {
    const stored = sessionStorage.getItem('praefectus_utm');
    if (stored) return JSON.parse(stored);
  } catch {}
  return getUtmParams();
}

// Meta Pixel events
export function trackPixelEvent(eventName: string, data?: Record<string, any>) {
  if (typeof window !== 'undefined' && (window as any).fbq) {
    (window as any).fbq('track', eventName, data);
  }
}

// Google Analytics 4 events
export function trackGA4Event(eventName: string, params?: Record<string, any>) {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', eventName, params);
  }
}

// Track lead submission
export function trackLeadConversion(data: { email: string; plano?: string }) {
  trackPixelEvent('Lead', { content_name: 'PRAEFECTUS Trial', currency: 'BRL' });
  trackGA4Event('generate_lead', { event_category: 'engagement', event_label: data.plano || 'trial' });
  trackGA4Event('conversion', { send_to: 'AW-CONVERSION_ID/CONVERSION_LABEL', value: 0, currency: 'BRL' });
}
