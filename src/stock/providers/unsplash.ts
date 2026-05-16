export interface UnsplashPhoto {
  id: string;
  urls: { regular: string; small: string };
  alt_description: string | null;
}

interface UnsplashSearchResponse {
  results: UnsplashPhoto[];
  total: number;
}

export class UnsplashProvider {
  async searchPhoto(query: string): Promise<string | null> {
    const key = process.env['UNSPLASH_ACCESS_KEY'];
    if (!key) return null;

    try {
      const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1`;
      const res = await fetch(url, {
        headers: { Authorization: `Client-ID ${key}` },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as UnsplashSearchResponse;
      return data.results[0]?.urls.regular ?? null;
    } catch {
      return null;
    }
  }
}
