export default {
  name: 'voice-agent',
  port: 8090,
  dataDir: './pb_data',
  database: { type: 'sqlite' },
  auth: { providers: ['email'] },
  rateLimiting: { enabled: false },
  ai: { enabled: true },
}
