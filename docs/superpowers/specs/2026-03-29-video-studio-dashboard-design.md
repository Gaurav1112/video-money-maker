# Video Studio Dashboard — Design Spec

**Date:** 2026-03-29
**Status:** Approved
**Location:** Inside video-pipeline repo, React web UI at localhost:3000/studio

---

## Overview

Single-page mission control dashboard for rendering videos, viewing metadata, and getting posting strategy for YouTube, Instagram Reels, and YouTube Shorts — all from one screen.

---

## Layout (3-Column)

### Left Panel: Topic Selector (20% width)
- List all topics from `content/` directory
- Checkbox per topic (multi-select)
- Search/filter input at top
- "Select All" / "Clear" buttons
- Show session count per topic (e.g., "Load Balancing (12 sessions)")
- Show render status icon per topic: ✅ rendered, ⏳ pending, 🔄 rendering

### Center Panel: Controls + Render Queue (45% width)

**Session Control Section:**
- When topic(s) selected, show session checkboxes: [☑ All] ☑1 ☑2 ☑3 ☐4 ...
- Quality toggle: Full 1080p / Fast 540p preview
- Big "RENDER SELECTED" button (saffron gradient)
- "Convert to Shorts" button (generates Reels + Shorts from rendered videos)

**Render Queue Section:**
- Real-time list of rendering jobs
- Each job shows: topic, session, status (queued/rendering/done/failed), progress %, ETA, file size
- Auto-scrolls as new jobs complete
- Total progress bar at top: "Rendering 3/15 sessions (20%)"

### Right Panel: Output + Metadata + Strategy (35% width)

**Tabs:** Long-Form | Shorts | Reels | Posting Strategy

**Long-Form Tab (per video):**
- Video file path + size + duration
- Copy-to-clipboard buttons for each:
  - YouTube Title
  - YouTube Description (first 2 lines optimized)
  - YouTube Tags (comma-separated)
  - YouTube Pinned Comment
  - YouTube Community Post
- Thumbnail preview (if generated)

**Shorts Tab (per short clip):**
- List of 3-5 shorts per long video
- Each short shows:
  - Clip filename + duration (30-59s)
  - YouTube Shorts title
  - YouTube Shorts description (with guru-sishya.in link)
  - Source timestamp range (e.g., "0:42 - 1:28")
  - Copy-to-clipboard for title + description

**Reels Tab (per reel):**
- Same clips as shorts but with Instagram-specific metadata:
  - Instagram Caption (with 30 hashtags)
  - Cover text suggestion
  - Audio description (accessibility)
  - Hashtag groups (copy-paste ready)

**Posting Strategy Tab:**
- Optimal posting schedule for selected videos:
  - YouTube long-form: Best days (Mon/Wed/Fri), best times (9 AM, 2 PM IST)
  - YouTube Shorts: Daily at 12 PM IST
  - Instagram Reels: Daily at 6 PM IST
- Week calendar view showing when to post what:
  ```
  Mon 9AM IST:  📺 YouTube: Load Balancing S1
  Mon 12PM IST: 📱 Short: "Load Balancing in 60s"
  Tue 6PM IST:  📸 Reel: "90% of Devs Get This Wrong"
  Wed 9AM IST:  📺 YouTube: Load Balancing S2
  ...
  ```
- Manual checklist per video:
  - ☐ Upload to YouTube
  - ☐ Set title/description/tags
  - ☐ Add end screen
  - ☐ Pin comment
  - ☐ Post community post
  - ☐ Upload Short #1
  - ☐ Upload Short #2
  - ☐ Upload Reel #1 to Instagram
  - ☐ Upload Reel #2 to Instagram
  - ☐ Add to "Interview Prep" highlight

---

## Tech Stack

- **Frontend:** React + Tailwind CSS (simple, no framework overhead)
- **Backend:** Express.js API routes in `src/api/server.ts` (already exists)
- **State:** React useState/useEffect (no Redux needed for single user)
- **Real-time:** Server-Sent Events (SSE) for render progress updates
- **Data:** Read content/ JSONs for topic list, read output/ for render status

## API Endpoints

- `GET /api/topics` — list all topics with session counts and render status
- `POST /api/render` — start rendering selected topics/sessions
- `GET /api/render/status` — SSE stream of render progress
- `GET /api/metadata/:topic/:session` — get full metadata (YT, IG, Shorts)
- `POST /api/convert-shorts` — convert long video to shorts
- `GET /api/schedule` — get optimal posting schedule for rendered videos

## File Structure

```
src/
  studio/
    index.html          — entry point
    App.tsx             — main layout
    components/
      TopicSelector.tsx — left panel
      SessionControl.tsx — controls
      RenderQueue.tsx   — progress list
      MetadataPanel.tsx — right panel with tabs
      PostingStrategy.tsx — schedule + checklist
    api.ts              — fetch helpers
  api/
    server.ts           — Express server (extend existing)
    routes/
      topics.ts
      render.ts
      metadata.ts
      schedule.ts
```
