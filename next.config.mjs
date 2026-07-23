/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    memoryBasedWorkers: true,
  },
  // Excluir tests del build de producción
  typescript: {
    ignoreBuildErrors: ['tests/', '**/*.test.ts', '**/*.spec.ts'],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;