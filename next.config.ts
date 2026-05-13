import type { NextConfig } from "next";

const config: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.fbcdn.net" }, { protocol: "https", hostname: "**.cdninstagram.com" }],
  },
};

export default config;
