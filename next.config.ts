import type { NextConfig } from "next";

const pdfWorkerFiles = [
  "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
  "./node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
  "./node_modules/pdfjs-dist/standard_fonts/**/*",
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist"],
  outputFileTracingIncludes: {
    "/api/analyze-tapu": pdfWorkerFiles,
    "/api/analyze-portfolio": pdfWorkerFiles,
  },
};

export default nextConfig;
