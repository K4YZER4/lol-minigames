import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lol-minigames.vercel.app";
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/room/", "/dev/"] },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
