import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/docx/moo': ['./templates/**'],
    '/api/docx/laporan': ['./templates/**'],
  },
};

export default nextConfig;
