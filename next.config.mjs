/** @type {import('next').NextConfig} */
const nextConfig = {
  // Never keep a client-side cache of pages between navigations — each page is
  // per-user data behind row-level security, so it must always refetch. This
  // prevents one logged-in user briefly seeing a page rendered for another.
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
};

export default nextConfig;
