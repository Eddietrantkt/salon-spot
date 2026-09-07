const renderApiOrigin = process.env.RENDER_API_ORIGIN?.replace(/\/$/, '');

if (!renderApiOrigin?.startsWith('https://')) {
  throw new Error('RENDER_API_ORIGIN must be an https Render API origin, for example https://salon-spot-api.onrender.com');
}

export default {
  installCommand: 'corepack enable && pnpm install --frozen-lockfile',
  buildCommand: 'pnpm --filter @salon-spot/contracts build && pnpm --filter @salon-spot/web build',
  outputDirectory: 'apps/web/dist',
  rewrites: [
    {
      source: '/api/:path*',
      destination: `${renderApiOrigin}/api/:path*`
    }
  ]
};
