import { http, HttpResponse } from 'msw';

/** Shared MSW fixtures for IP providers (Phase 7 / 17). */
export const ipApiSuccess = {
  status: 'success',
  query: '8.8.8.8',
  country: 'United States',
  countryCode: 'US',
  regionName: 'California',
  city: 'Mountain View',
  lat: 37.386,
  lon: -122.0838,
  timezone: 'America/Los_Angeles',
  currency: 'USD',
  isp: 'Google LLC',
  org: 'Google Public DNS',
  as: 'AS15169 Google LLC',
  asname: 'GOOGLE',
  mobile: false,
  proxy: false,
  hosting: true,
};

export const ipWhoSuccess = {
  success: true,
  ip: '8.8.8.8',
  country: 'United States',
  country_code: 'US',
  city: 'Mountain View',
  region: 'California',
  latitude: 37.386,
  longitude: -122.0838,
  timezone: { id: 'America/Los_Angeles' },
  currency: { code: 'USD' },
  connection: { isp: 'Google LLC', org: 'Google Public DNS', asn: 15169 },
};

export const ipProviderHandlers = [
  http.get('http://ip-api.com/json/:ip', ({ params }) => {
    return HttpResponse.json({ ...ipApiSuccess, query: String(params.ip) });
  }),
  http.get('https://ipwho.is/:ip', ({ params }) => {
    return HttpResponse.json({ ...ipWhoSuccess, ip: String(params.ip) });
  }),
];
