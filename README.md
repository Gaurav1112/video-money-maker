# AI Video Pipeline

Automated Fireship/Khan GS-style teaching video generation for software engineering interview prep.

Generates professional animated code tutorial videos from lesson content and auto-publishes daily to YouTube + Instagram Reels. **Zero cost infrastructure.**

## Features

- **11 Remotion video components** (Dark Scholar theme)
- **Kokoro TTS** narration (self-hosted, human-quality voice)
- **Multi-language** code examples (Python + Java)
- **3 output formats**: YouTube (16:9), Instagram Reels (9:16), Thumbnails
- **Auto-publish** via n8n workflow (YouTube + Instagram daily)
- **SQLite queue** for content management
- **Express API** for render orchestration

## Quick Start

### Prerequisites
- Node.js 18+
- Docker (for Kokoro TTS)

### Install
```bash
git clone https://github.com/YOUR_USERNAME/video-pipeline.git
cd video-pipeline
npm install
cp .env.example .env
```

### Generate Pilot Video (no Docker needed)
```bash
npm run pilot
```

This generates a demo "Load Balancing" lesson with 14 scenes, both Python and Java versions.

### Preview in Remotion Studio
```bash
npm start
# Visit http://localhost:3000
```

### Start TTS + Automation
```bash
docker-compose up -d   # Start Kokoro TTS + n8n
npm run api             # Start Express API
```

## Architecture

```
Content (JSON) → Script Generator → Kokoro TTS → Storyboard → Remotion Render → Publish
```

### Pipeline Flow
1. **Content Loader** reads Guru Sishya JSON or demo content
2. **Script Generator** converts markdown → narration scenes (with hooks!)
3. **TTS Engine** generates audio via Kokoro (fallback to estimation)
4. **Storyboard Generator** maps scenes to frame-precise timing
5. **Batch Renderer** renders Long + Short + Thumbnail via Remotion CLI
6. **n8n Workflow** auto-publishes daily to YouTube + Instagram

### Video Components (Dark Scholar Theme)
| Component | Purpose |
|-----------|---------|
| TitleSlide | Opening with topic, session, objectives |
| CodeReveal | Line-by-line code animation |
| TextSection | Heading + staggered bullet points |
| DiagramSlide | SVG diagram with fade-in |
| ComparisonTable | Row-by-row reveal table |
| InterviewInsight | Gold-bordered callout card |
| ReviewQuestion | Q&A with delayed answer reveal |
| SummarySlide | Key takeaways |
| ProgressBar | Bottom progress indicator |
| TopicHeader | Persistent header overlay |
| Thumbnail | YouTube thumbnail still frame |

## Tech Stack (All Free)

| Component | Technology | Cost |
|-----------|-----------|------|
| Video Framework | Remotion v4 (React) | Free |
| TTS | Kokoro 82M (self-hosted Docker) | Free |
| Code Highlighting | Shiki | Free |
| API Server | Express | Free |
| Database | SQLite (better-sqlite3) | Free |
| Automation | n8n Community | Free |
| Publishing | YouTube Data API + Instagram Graph API | Free |
| **Total** | | **$0/month** |

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Open Remotion Studio |
| `npm test` | Run tests |
| `npm run pilot` | Generate pilot video (demo content) |
| `npm run api` | Start Express API server |
| `npm run dev` | Start Studio + API concurrently |
| `npm run build` | TypeScript build |

## Environment Variables

See `.env.example` for all configuration options.

## Content

The pipeline reads content from Guru Sishya's JSON files at `../guru-sishya/public/content/`. If not available, a built-in demo session (Load Balancing) is used.

## Revenue Model

- YouTube ad revenue (CPM $8-20 for educational content)
- Instagram Reels reach for traffic
- Drive viewers to Guru Sishya app
- Sponsorship opportunities at 10K+ subscribers

## License

MIT
