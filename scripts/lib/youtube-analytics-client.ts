// scripts/lib/youtube-analytics-client.ts
import { google, youtubeAnalytics_v2 } from 'googleapis';
import { getYouTubeAuthClient } from './youtube-oauth.js';

export interface VideoMetrics {
  videoId: string;
  fetchedAt: string;           // ISO datetime
  views: number;
  likes: number;
  comments: number;
  averageViewDuration: number; // seconds
  averageViewPercentage: number; // 0-100
  shares: number;
  estimatedMinutesWatched: number;
}

const METRIC_NAMES = [
  'views',
  'likes',
  'comments',
  'averageViewDuration',
  'averageViewPercentage',
  'shares',
  'estimatedMinutesWatched',
] as const;

export async function getYouTubeAnalyticsClient(): Promise<youtubeAnalytics_v2.Youtubeanalytics> {
  const auth = getYouTubeAuthClient();
  return google.youtubeAnalytics({ version: 'v2', auth });
}

/**
 * Pull aggregate per-video metrics for the last `days` days.
 * Returns one VideoMetrics per video.
 */
export async function fetchVideoMetrics(videoIds: string[], days = 30): Promise<VideoMetrics[]> {
  if (videoIds.length === 0) return [];
  const analytics = await getYouTubeAnalyticsClient();
  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const out: VideoMetrics[] = [];
  for (const videoId of videoIds) {
    const resp = await analytics.reports.query({
      ids: 'channel==MINE',
      startDate, endDate,
      metrics: METRIC_NAMES.join(','),
      filters: `video==${videoId}`,
    });
    const row = resp.data.rows?.[0];
    if (!row) {
      console.warn(`[youtube-analytics] no rows for videoId=${videoId} (${startDate}→${endDate}), skipping`);
      continue;
    }
    out.push({
      videoId,
      fetchedAt: new Date().toISOString(),
      views: Number(row[METRIC_NAMES.indexOf('views')] ?? 0),
      likes: Number(row[METRIC_NAMES.indexOf('likes')] ?? 0),
      comments: Number(row[METRIC_NAMES.indexOf('comments')] ?? 0),
      averageViewDuration: Number(row[METRIC_NAMES.indexOf('averageViewDuration')] ?? 0),
      averageViewPercentage: Number(row[METRIC_NAMES.indexOf('averageViewPercentage')] ?? 0),
      shares: Number(row[METRIC_NAMES.indexOf('shares')] ?? 0),
      estimatedMinutesWatched: Number(row[METRIC_NAMES.indexOf('estimatedMinutesWatched')] ?? 0),
    });
  }
  return out;
}
