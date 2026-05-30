import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Dev-server cross-origin allow-list.
   *
   * Next.js 16 blocks cross-origin requests to dev-only resources
   * (e.g. `/_next/webpack-hmr`) by default. When a developer drives
   * the local NXiSAS engine via Mr. 진명준's hosts-file workaround
   * (per memory `reference_nxisas_local_engine_origin.md`) the page
   * loads from a licensed Coocon domain alias mapped to 127.0.0.1
   * — Next.js then refuses HMR and the dev experience breaks.
   *
   * Listing the alias here keeps HMR + source maps working on the
   * alias hostname without weakening the production build (this
   * config is dev-only).
   *
   * If a developer uses a different licensed alias domain (e.g.
   * one Mr. 진명준 specifies for their machine), add it to this
   * list alongside `sample.coocon.co.kr`.
   */
  allowedDevOrigins: ["sample.coocon.co.kr"],
};

export default nextConfig;
