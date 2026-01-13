import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://opencode.micr.dev';
  
  const routes = [
    '',
    '/mcp',
    '/skills',
    '/plugins',
    '/commands',
    '/usage',
    '/auth',
    '/settings',
    '/config',
    '/quickstart',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  return routes;
}
