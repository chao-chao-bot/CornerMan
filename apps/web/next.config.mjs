/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@cornerman/ui",
    "@cornerman/api-client",
    "@cornerman/shared-types"
  ]
};

export default nextConfig;
