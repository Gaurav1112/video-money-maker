# SEO Automation Workflows

## Overview

This document outlines automated SEO workflows for YouTube Shorts and long-form content. Focuses on keyword research, description generation, tag management, and algorithm optimization.

---

## 1. Keyword Research Automation

### Current State
- Manual keyword selection from topic list
- No trend analysis
- No competitor research
- No search volume data

### Recommended System: Multi-Source Keyword Pipeline

#### **Data Sources**

**1. YouTube Trends API (Free)**
```typescript
// scripts/get-youtube-trends.ts (new)
import axios from 'axios';

async function getYouTubeTrends(region: string = 'IN') {
  const response = await axios.get(
    `https://www.youtube.com/api/v3/trending`,
    {
      params: {
        part: 'snippet',
        chart: 'mostPopular',
        regionCode: region,
        maxResults: 50,
        key: process.env.YOUTUBE_API_KEY,
      },
    }
  );
  
  return response.data.items.map(item => ({
    title: item.snippet.title,
    category: item.snippet.categoryId,
    views: item.statistics.viewCount,
  }));
}
```

**2. Google Trends API (Paid)**
```
Cost: $0.02 per query (via Third-party APIs)
Service: pytrends (Python, unofficial but free)
Integration: REST API or Python script
```

**3. SEMrush API (Competitor Analysis)**
```
Cost: $99-449/month
Alternative: Ahrefs ($99/month)
Benefit: Keyword difficulty, search volume, CPC
```

**4. Answer the Public / Featured Snippets**
```
Cost: $99/month
Benefit: Question-based keywords ("how to...", "what is...")
Integration: REST API
```

### Unified Keyword Pipeline

```typescript
// scripts/generate-keywords-automated.ts (new)
import { google } from 'googleapis';
import { pytrendsClient } from '@src/lib/pytrends';

interface KeywordData {
  term: string;
  searchVolume: number;
  difficulty: number; // 0-100
  cpc: number;
  trend: 'up' | 'stable' | 'down';
  category: string;
  source: 'youtube-trends' | 'google-trends' | 'semrush' | 'ahrefs';
}

async function generateKeywordsForTopic(topic: string): Promise<KeywordData[]> {
  const keywords: KeywordData[] = [];
  
  // 1. Get YouTube Trends
  const ytTrends = await getYouTubeTrends();
  const topicTrends = ytTrends.filter(t => t.title.includes(topic));
  
  // 2. Get Google Trends
  const googleTrends = await pytrendsClient.getTrending(topic);
  
  // 3. Get Semrush keywords (if API available)
  let semrushData: KeywordData[] = [];
  if (process.env.SEMRUSH_API_KEY) {
    semrushData = await getSemrushKeywords(topic);
  }
  
  // 4. Merge and deduplicate
  const merged = mergeKeywordSources([
    topicTrends.map(t => ({
      term: extractKeyword(t.title),
      trend: getTrendDirection(t),
      source: 'youtube-trends',
    })),
    googleTrends.map(t => ({
      term: t.keyword,
      trend: t.trend,
      source: 'google-trends',
    })),
    semrushData,
  ]);
  
  // 5. Rank by relevance + trend + search volume
  const scored = scoreKeywords(merged);
  
  return scored.sort((a, b) => b.searchVolume - a.searchVolume).slice(0, 15);
}

function scoreKeywords(keywords: KeywordData[]): KeywordData[] {
  return keywords.map(kw => ({
    ...kw,
    score: 
      (kw.searchVolume * 0.4) +
      (kw.trend === 'up' ? 1000 : 0) +
      (100 - kw.difficulty * 0.3) +
      (kw.source === 'youtube-trends' ? 500 : 0),
  })).sort((a, b) => b.score - a.score);
}
```

### Integration with Video Pipeline

```typescript
// In generate-metadata.ts, replace static keywords
const metadata = {
  title: generateSEOTitle(video.topic, keywords),
  description: generateSEODescription(video.script, keywords),
  tags: keywords.slice(0, 30),
  category: detectCategory(keywords),
  language: 'en',
};
```

---

## 2. Auto-Generate SEO Descriptions

### Current System
- Template-based descriptions
- Manual keyword insertion
- Limited customization

### Recommended: AI-Powered Generation

```typescript
// scripts/generate-seo-descriptions.ts (new)
import OpenAI from 'openai';

async function generateDescription(params: {
  title: string;
  script: string;
  keywords: string[];
  videoLength: number;
}) {
  const client = new OpenAI();
  
  const prompt = `
    Create a YouTube video description (400-500 characters) that:
    
    1. Naturally includes these keywords: ${params.keywords.slice(0, 5).join(', ')}
    2. Starts with a compelling hook (first sentence)
    3. Has a clear call-to-action (like/subscribe/comment)
    4. Includes timestamps for main sections (if ${params.videoLength} > 5 min)
    5. Follows YouTube's 5000-character limit
    
    Video Title: ${params.title}
    Main Topics: ${params.script.slice(0, 500)}...
    
    Generate ONLY the description text, no additional commentary.
  `;
  
  const response = await client.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: [
      { role: 'system', content: 'You are a YouTube SEO expert.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 300,
  });
  
  return response.choices[0].message.content;
}

// Workflow integration
async function generateUploadMetadata(video: VideoInfo) {
  const keywords = await generateKeywordsForTopic(video.topic);
  const description = await generateDescription({
    title: video.title,
    script: video.script,
    keywords,
    videoLength: video.duration,
  });
  
  return {
    title: video.title,
    description,
    keywords,
    tags: keywords.slice(0, 30),
  };
}
```

### Quality Validation

```typescript
// Ensure description quality
function validateDescription(desc: string, keywords: string[]) {
  const issues: string[] = [];
  
  // Check keyword density (2-3% target)
  const keywordCount = keywords.filter(k => 
    desc.toLowerCase().includes(k.toLowerCase())
  ).length;
  
  if (keywordCount < keywords.length * 0.4) {
    issues.push('⚠️ Low keyword coverage (<40%)');
  }
  
  if (desc.length > 5000) {
    issues.push('⚠️ Description too long (>5000 chars)');
  }
  
  if (!desc.match(/[Ll]ike|[Ss]ubscribe|[Cc]omment/)) {
    issues.push('⚠️ Missing call-to-action');
  }
  
  if (!desc.match(/[Cc]ontents|[Tt]imestamps|[0-9]:[0-9]{2}/)) {
    issues.push('⚠️ Missing timestamps (for long videos)');
  }
  
  return { isValid: issues.length === 0, issues };
}
```

---

## 3. Automated Tag Strategy

### Current System
- Manual tag selection
- No systematic approach
- Limited to 30 tags

### Recommended: Strategic Tag Automation

#### **Tag Categories**

```typescript
// scripts/generate-tags-strategic.ts (new)

interface TagStrategy {
  exact: string[];        // Video topic (1-3)
  related: string[];      // Adjacent topics (5-10)
  trending: string[];     // Trending terms (5-10)
  longtail: string[];     // Long-tail keywords (5-10)
  branded: string[];      // Channel/series (2-3)
}

async function generateTagStrategy(topic: string): Promise<TagStrategy> {
  return {
    // 1. Exact match tags (high relevance, medium volume)
    exact: [
      topic.toLowerCase(),
      `how to ${topic}`,
      `${topic} tutorial`,
    ],
    
    // 2. Related tags (from keyword research)
    related: await getRelatedKeywords(topic),
    
    // 3. Trending tags (from Google Trends)
    trending: await getTrendingRelated(topic),
    
    // 4. Long-tail tags (low volume, high intent)
    longtail: await generateLongtail(topic),
    
    // 5. Branded tags (channel identity)
    branded: [
      'system design',
      'interview prep',
      'software engineering',
    ],
  };
}

// Combine into final tag list
async function finalizeTagList(topic: string): Promise<string[]> {
  const strategy = await generateTagStrategy(topic);
  
  const allTags = [
    ...strategy.exact,
    ...strategy.trending,
    ...strategy.related,
    ...strategy.longtail,
    ...strategy.branded,
  ]
    .filter((tag, i, arr) => arr.indexOf(tag) === i) // deduplicate
    .slice(0, 30); // YouTube limit
  
  return allTags;
}
```

#### **Tag Performance Tracking**

```typescript
// Monitor which tags drive impressions
async function trackTagPerformance(videoId: string) {
  const stats = await youtube.videos.list({
    id: videoId,
    part: 'statistics,snippet',
  });
  
  const tags = stats.data.items[0].snippet.tags;
  const impressions = stats.data.items[0].statistics.viewCount;
  
  // Store tag performance
  db.run(
    `INSERT INTO tag_performance (video_id, tag, impressions)
     VALUES (?, ?, ?)`,
    [videoId, tags.join(','), impressions]
  );
}

// Recommend best tags over time
function getTopPerformingTags(category: string): string[] {
  const rows = db.all(
    `SELECT tag, AVG(impressions) as avg_impressions
     FROM tag_performance
     WHERE category = ?
     GROUP BY tag
     ORDER BY avg_impressions DESC
     LIMIT 30`,
    [category]
  );
  
  return rows.map(r => r.tag);
}
```

---

## 4. YouTube Algorithm Optimization

### Monitor Algorithm Signals

```typescript
// scripts/monitor-algorithm.ts (new)
import { youtube_v3 } from 'googleapis';

async function analyzeAlgorithmSignals(videoId: string) {
  const analytics = await getYouTubeAnalytics(videoId);
  
  return {
    // Click-through rate (target: >4%)
    ctr: (analytics.clicks / analytics.impressions) * 100,
    
    // Average view duration (target: >50% of duration)
    avd: (analytics.watchTime / (analytics.views * analytics.videoDuration)) * 100,
    
    // Likes per 1K views (target: >40)
    engagementRate: (analytics.likes / (analytics.views / 1000)),
    
    // Comments per 1K views (target: >10)
    commentRate: (analytics.comments / (analytics.views / 1000)),
    
    // Shares per 1K views (target: >5)
    shareRate: (analytics.shares / (analytics.views / 1000)),
    
    // Click-to-subscribe rate (target: >2%)
    subscriberRate: (analytics.newSubscribers / analytics.clicks) * 100,
    
    // Recommendation feed placement rate
    externalClicksRate: (analytics.externalClicks / analytics.impressions) * 100,
    
    // Audience retention cohort (how many stay to end)
    retentionCohort: analytics.retentionPercentage,
  };
}

// Compare against benchmarks
async function getAlgorithmHealth(videoId: string) {
  const signals = await analyzeAlgorithmSignals(videoId);
  
  const benchmarks = {
    ctr: { target: 4, current: signals.ctr, status: signals.ctr > 4 ? '✅' : '⚠️' },
    avd: { target: 50, current: signals.avd, status: signals.avd > 50 ? '✅' : '⚠️' },
    engagement: { target: 40, current: signals.engagementRate, status: signals.engagementRate > 40 ? '✅' : '⚠️' },
    comments: { target: 10, current: signals.commentRate, status: signals.commentRate > 10 ? '✅' : '⚠️' },
  };
  
  return benchmarks;
}
```

### Auto-Adjust Posting Strategy

```typescript
// scripts/optimize-post-schedule.ts (new)

async function optimizeUploadSchedule() {
  // Analyze last 30 videos' performance by upload time
  const videosByTime = await getVideosByUploadTime();
  
  // Group by hour and calculate avg CTR
  const ctrByHour = videosByTime.map(group => ({
    hour: group.uploadHour,
    avgCtr: average(group.videos.map(v => v.ctr)),
    videoCount: group.videos.length,
  }));
  
  // Find optimal upload window
  const optimalHour = ctrByHour
    .filter(h => h.videoCount >= 3) // Need sample size
    .sort((a, b) => b.avgCtr - a.avgCtr)[0].hour;
  
  console.log(`📊 Optimal upload time: ${optimalHour}:00`);
  
  // Update workflow schedule
  return `cron: '0 ${optimalHour} * * *'`;
}
```

### Real-Time Trending Detection

```typescript
// scripts/detect-trending-topics.ts (new)
import axios from 'axios';

async function detectTrendingTopics() {
  // 1. Get trending searches (Google Trends)
  const trending = await getTrendingFromGoogle();
  
  // 2. Filter for tech/engineering content
  const techTrending = trending.filter(t => 
    t.category.includes('Technology') || 
    t.category.includes('Science')
  );
  
  // 3. Check if we have content on these topics
  const gaps = techTrending.filter(t => 
    !doesTopicExist(t.keyword)
  );
  
  // 4. Alert for content creation
  if (gaps.length > 0) {
    await notifyContentTeam({
      type: 'TRENDING_TOPIC_ALERT',
      topics: gaps,
      deadline: 'ASAP',
    });
  }
  
  return gaps;
}
```

---

## 5. Automated Playlist & Series Management

### Dynamic Playlist Assignment

```typescript
// scripts/assign-playlists.ts (new)

async function assignPlaylist(videoId: string, topic: string) {
  const client = youtube.youtube('v3');
  
  // 1. Find or create playlist for topic
  const playlist = await findOrCreatePlaylist(topic);
  
  // 2. Add video to playlist
  await client.playlistItems.insert({
    part: 'snippet',
    resource: {
      snippet: {
        playlistId: playlist.id,
        resourceId: {
          kind: 'youtube#video',
          videoId: videoId,
        },
      },
    },
  });
  
  console.log(`✅ Added to playlist: ${playlist.title}`);
}

// Organize by series
async function createSeriesPlaylists() {
  const series = [
    { name: 'System Design Fundamentals', topics: ['load balancing', 'caching', 'databases'] },
    { name: 'Advanced Algorithms', topics: ['sorting', 'graph', 'dynamic programming'] },
    { name: 'Interview Preparation', topics: ['behavioral', 'technical', 'negotiation'] },
  ];
  
  for (const s of series) {
    const playlist = await createPlaylist(s.name);
    await associateTopics(playlist.id, s.topics);
  }
}
```

---

## 6. Monitoring & Reporting

### Daily SEO Health Dashboard

```typescript
// scripts/seo-dashboard.ts (new)

async function generateSEOReport(days: number = 7) {
  const report = {
    period: `Last ${days} days`,
    timestamp: new Date().toISOString(),
    videos: await getRecentVideos(days),
    metrics: {
      avgCTR: 0,
      avgAVD: 0,
      avgEngagement: 0,
      topPerformers: [],
      underperformers: [],
    },
    recommendations: [],
  };
  
  // Calculate metrics
  const videos = report.videos;
  report.metrics.avgCTR = average(videos.map(v => v.ctr));
  report.metrics.avgAVD = average(videos.map(v => v.avd));
  report.metrics.avgEngagement = average(videos.map(v => v.engagement));
  
  // Find outliers
  report.metrics.topPerformers = videos
    .filter(v => v.ctr > report.metrics.avgCTR * 1.5)
    .slice(0, 5);
  
  report.metrics.underperformers = videos
    .filter(v => v.ctr < report.metrics.avgCTR * 0.7)
    .slice(0, 5);
  
  // Generate recommendations
  report.recommendations = generateRecommendations(report.metrics);
  
  return report;
}

function generateRecommendations(metrics: any): string[] {
  const recs: string[] = [];
  
  if (metrics.avgCTR < 3.5) {
    recs.push('🎯 Thumbnails need improvement - consider testing variations');
  }
  
  if (metrics.avgAVD < 45) {
    recs.push('⏱️ Average view duration low - consider shorter videos or better pacing');
  }
  
  if (metrics.avgEngagement < 35) {
    recs.push('💬 Low engagement - add more CTAs or interactive elements');
  }
  
  return recs;
}
```

---

## Implementation Plan

### Week 1: Keyword Research
```
- Set up Google Trends API
- Build keyword generation script
- Test with 5 videos
```

### Week 2: Description & Tags
```
- Integrate OpenAI for descriptions
- Build tag strategy generator
- Update video upload workflow
```

### Week 3: Monitoring
```
- Build analytics dashboard
- Set up daily reports
- Deploy trending topic detector
```

### Week 4: Optimization
```
- Analyze tag performance
- Adjust posting schedule
- Implement A/B testing
```

---

## Cost Summary

| Service | Cost | Frequency | Annual |
|---------|------|-----------|--------|
| Google Trends API | $0 | Included | $0 |
| OpenAI GPT-4 | $0.02/desc | 50/month | $12 |
| YouTube API | $0 | Included | $0 |
| Semrush (optional) | $99 | Monthly | $1,188 |
| **Total** | - | - | **$12-1200** |

**ROI:** $12-$1,200 annual investment → +30% views/month (estimated +$750/month) = 1-month payback

