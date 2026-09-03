const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com', pathname: '/**' },
    ],
  },
  // Renamed from experimental.serverComponentsExternalPackages in Next 15
  serverExternalPackages: ['mongodb'],
  webpack(config, { dev }) {
    if (dev) {
      // Reduce CPU/memory from file watching
      config.watchOptions = {
        poll: 2000, // check every 2 seconds
        aggregateTimeout: 300, // wait before rebuilding
        ignored: ['**/node_modules'],
      };
    }
    return config;
  },
  onDemandEntries: {
    maxInactiveAge: 10000,
    pagesBufferLength: 2,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Platform embedding still works via CSP frame-ancestors below.
          { key: "Content-Security-Policy", value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "font-src 'self' data:",
            "connect-src 'self' ws:",
            "frame-ancestors *",
            "base-uri 'self'",
            "form-action 'self'",
            "object-src 'none'",
          ].join("; ") },
          // Blocks MIME-type sniffing (was missing entirely before).
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Don't leak full URLs to third parties.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Only features the app actually uses; camera/mic explicitly off.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
