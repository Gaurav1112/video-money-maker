export interface SfxClip {
  id: string;
  name: string;
  url: string;
  license: string;
}

interface FreesoundResult {
  id: number;
  name: string;
  previews: { 'preview-lq-mp3': string };
  license: string;
}

interface FreesoundResponse {
  results: FreesoundResult[];
}

export class FreesoundProvider {
  async searchSfx(tag: string): Promise<SfxClip[]> {
    const token = process.env['FREESOUND_API_KEY'];
    if (!token) return [];

    try {
      const url = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(tag)}&token=${encodeURIComponent(token)}&license=Creative+Commons+0`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = (await res.json()) as FreesoundResponse;
      return (data.results ?? [])
        .filter((r) => r.license?.toLowerCase().includes('creative commons 0') || r.license?.toLowerCase().includes('cc0'))
        .map((r) => ({
          id: `freesound-${r.id}`,
          name: r.name,
          url: r.previews['preview-lq-mp3'],
          license: 'CC0',
        }));
    } catch {
      return [];
    }
  }
}
