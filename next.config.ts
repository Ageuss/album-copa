import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "flagcdn.com" },
      { protocol: "https", hostname: "ui-avatars.com" },
      { protocol: "https", hostname: "encrypted-tbn0.gstatic.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "lncimg.lance.com.br" },
      { protocol: "https", hostname: "diariodejacarei.com.br" },
      // Supabase Storage (para fotos vindas do seu bucket)
      { protocol: "https", hostname: "amlunqxssdwlfgywbdbm.supabase.co" },
    ],
  },
};

export default nextConfig;
