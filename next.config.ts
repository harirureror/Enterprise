import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      /* Agenda dulu berdiri sendiri, sekarang jadi sub-tab Rencana. Permanen
         supaya penanda dan tautan lama tetap sampai, bukan mati. */
      { source: "/agenda", destination: "/rencana/agenda", permanent: true },
    ];
  },
};

export default nextConfig;
