import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  webpack: (config) => {
    // Add rule to handle shader files as raw text
    config.module.rules.push({
      test: /\.(glsl|vs|fs|vert|frag)$/,
      type: 'asset/source',
    });

    return config;
  },
};

export default nextConfig;
