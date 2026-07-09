import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  // Handle shader files as raw text under Turbopack (Next 16 default)
  turbopack: {
    rules: {
      '*.{glsl,vs,fs,vert,frag}': {
        loaders: ['raw-loader'],
        as: '*.js',
      },
    },
  },
  webpack: (config) => {
    // Add rule to handle shader files as raw text (used with --webpack)
    config.module.rules.push({
      test: /\.(glsl|vs|fs|vert|frag)$/,
      type: 'asset/source',
    });

    return config;
  },
};

export default nextConfig;
