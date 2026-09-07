import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Prefiks alamat aplikasi. Kosong di laptop, "/dashboard" di server, supaya
     akar domain bisa dipakai landing page publik.

     Next perlu tahu prefiks ini saat BUILD, bukan cuma di nginx: kalau hanya
     nginx yang tahu, seluruh aset dan tautan internal tetap menunjuk ke akar
     dan halamannya rusak. Karena itu nilainya harus sama persis dengan
     `location` di nginx — satu sumber, dibaca saat build maupun saat jalan. */
  basePath: process.env.APP_BASE_PATH || undefined,

  async redirects() {
    return [
      /* Agenda dulu berdiri sendiri, sekarang jadi sub-tab Rencana. Permanen
         supaya penanda dan tautan lama tetap sampai, bukan mati. */
      { source: "/agenda", destination: "/rencana/agenda", permanent: true },
    ];
  },
};

export default nextConfig;
