/** @type {import('next').NextConfig} */
const config = {
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
};

export default config;
