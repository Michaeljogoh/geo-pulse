process.env.NODE_ENV = 'test';
process.env.PORT = '8080';
process.env.LOG_LEVEL = 'silent';
process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:3000';
process.env.FIREBASE_PROJECT_ID = 'geoip-crypto-intel-test';
process.env.FIREBASE_CLIENT_EMAIL = 'sa@geoip-crypto-intel-test.iam.gserviceaccount.com';
process.env.FIREBASE_PRIVATE_KEY =
  '-----BEGIN PRIVATE KEY-----\\nTEST_KEY\\n-----END PRIVATE KEY-----\\n';
process.env.CRYPTOPANIC_TOKEN = 'test-cryptopanic-token';
process.env.CACHE_ENABLED = 'true';
process.env.IP_PROVIDER = 'ipapi';
process.env.COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
