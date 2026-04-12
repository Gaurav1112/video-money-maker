# Video Pipeline — Project Rules

## Architecture Overview

```
video-pipeline/
├── src/
│   ├── compositions/          # Remotion video compositions
│   │   ├── LongVideo.tsx      # Main 16:9 long-form (8-12 min)
│   │   ├── ViralShort.tsx     # 9:16 portrait shorts/reels
│   │   ├── index.tsx          # Composition registry + calculateMetadata
│   │   └── Thumbnail.tsx      # 1280x720 thumbnail generator
│   │
│   ├── components/            # React visual components
│   │   ├── IntroSlide.tsx     # 5s cinematic hook (6 styles, 50+ topic configs)
│   │   ├── TitleSlide.tsx     # 30s movie-trailer opening (4 phases, topic-aware)
│   │   ├── TextSection.tsx    # Text scenes — uses TemplateFactory
│   │   ├── CodeReveal.tsx     # Code scenes — typewriter + spotlight + output panel
│   │   ├── ComparisonTable.tsx # VS Battle cards
│   │   ├── InterviewInsight.tsx # Mock interview layout
│   │   ├── ReviewQuestion.tsx  # Game show quiz (4 options + countdown)
│   │   ├── SummarySlide.tsx   # Checklist + money shot diagram
│   │   ├── CaptionOverlay.tsx # Word-by-word captions (fireship/hormozi modes)
│   │   ├── CinematicOpener.tsx # 6 cinematic styles per topic
│   │   ├── PatternInterruptLayer.tsx # 5 interrupt types every 5-8s
│   │   ├── BrandingLayer.tsx  # Dual marquee (top + bottom scrolling bars)
│   │   ├── BackgroundLayer.tsx # Per-scene animated backgrounds
│   │   ├── FilmGrain.tsx      # SVG film grain overlay (deterministic)
│   │   ├── BgmLayer.tsx       # Multi-track BGM with crossfade
│   │   ├── SfxLayer.tsx       # Sound effects synced to word timestamps
│   │   ├── ProgressBar.tsx    # Bottom bar + milestones at 25/50/75%
│   │   ├── templates/         # Visual template factory system
│   │   │   ├── TemplateFactory.tsx    # Central dispatcher (57 templates)
│   │   │   ├── ArchitectureRenderer.tsx + configs
│   │   │   ├── FlowRenderer.tsx + configs
│   │   │   ├── ConceptRenderer.tsx + configs
│   │   │   ├── ComparisonRenderer.tsx + configs
│   │   │   └── MonitoringRenderer.tsx + configs
│   │   └── viz/               # Animated primitives
│   │       ├── AnimatedBox.tsx   # Labeled box + icon + spring + wobble
│   │       ├── AnimatedArrow.tsx # SVG draw via evolvePath + wobble
│   │       ├── ProgressiveReveal.tsx # Beat-synced element reveals
│   │       └── DataFlowParticles.tsx # Dots moving along SVG paths
│   │
│   ├── pipeline/              # Content → Video pipeline
│   │   ├── tts-engine.ts      # Edge TTS (primary) + Kokoro (fallback)
│   │   ├── script-generator.ts # Content JSON → Scene[] (2500+ lines)
│   │   ├── storyboard.ts      # Scenes + audio → timed Storyboard
│   │   ├── audio-stitcher.ts  # Concatenate scene audio into master track
│   │   ├── content-generator.ts # AI content generation
│   │   └── metadata-generator.ts # YouTube/Instagram metadata
│   │
│   ├── lib/                   # Shared utilities
│   │   ├── video-styles.ts    # Educational + Viral style configs
│   │   ├── visual-templates.ts # 57 template registry + keyword matcher
│   │   ├── visual-beats.ts    # Sentence-synced visual beat computation
│   │   ├── hook-generator.ts  # 7 hook formulas (dual text + spoken)
│   │   ├── open-loops.ts      # Contradiction-based curiosity gaps
│   │   ├── topic-categories.ts # Topic slug → category mapping
│   │   ├── sfx-triggers.ts    # Auto SFX generation from scene content
│   │   ├── quiz-options.ts    # Generate 3 wrong answers per quiz
│   │   ├── icon-mapper.ts     # 100+ tech keywords → Simple Icons SVGs
│   │   ├── lottie-assets.ts   # 15 Lottie animation registry
│   │   ├── bg-images.ts       # Scene type → background photo
│   │   ├── tech-terms.ts      # Tech term dictionary for keyword detection
│   │   ├── wobble.ts          # Deterministic Perlin noise wobble
│   │   ├── theme.ts           # Colors, fonts, sizes
│   │   ├── constants.ts       # Timing, durations, formats
│   │   ├── animations.ts      # Easing, spring, fade helpers
│   │   └── sync-engine.ts     # SyncTimeline for audio/word sync
│   │
│   ├── hooks/
│   │   ├── useVisualBeat.ts   # Active beat + progress from frame
│   │   └── useSync.ts         # Global sync timeline access
│   │
│   └── types.ts               # Scene, Storyboard, WordTimestamp, VisualBeat
│
├── scripts/
│   ├── render-session.ts      # Generate storyboard for one session
│   ├── batch-render-topic.sh  # Render all sessions of a topic
│   ├── render-viral-shorts.ts # Render portrait shorts via ViralShort
│   ├── make-reels.ts          # Trim best 5-min segment from long video
│   ├── export-dialogue.ts     # Export narration + timestamps for external TTS
│   └── render-all-topics.sh   # Render everything
│
├── content/                   # Symlink to guru-sishya/public/content/
├── public/audio/              # TTS audio files + BGM + SFX
├── public/lottie/             # Lottie JSON animations
├── public/images/bg/          # Background stock photos
└── output/                    # Rendered videos + props JSON
```

## Key Data Flow

```
Content JSON (66 topics, 784 sessions)
  → script-generator.ts (generates Scene[])
    → tts-engine.ts (Edge TTS → audio + word timestamps)
      → audio-stitcher.ts (master audio track)
        → storyboard.ts (timed Storyboard with visual beats + templates)
          → LongVideo.tsx (Remotion render → MP4)
```

## Commands

```bash
# Generate + render one session
npx tsx scripts/render-session.ts <topic-slug> <session-number>
npx remotion render src/compositions/index.tsx LongVideo output/<name>.mp4 --props=output/test-props-s<N>.json --concurrency=4

# Batch render entire topic (10 sessions)
bash scripts/batch-render-topic.sh <topic-slug> 10

# Preview in browser
npx remotion studio

# Type check
npx tsc --noEmit
```

## Tech Stack
- Remotion 4.0.441, React 19, TypeScript
- **Chatterbox TTS (PRIMARY — sounds human, MIT)** + Edge TTS (fallback) + Kokoro af_heart (fallback)
- @remotion/transitions, @remotion/paths, @remotion/lottie
- roughjs, noisejs (hand-drawn look + organic wobble)
- Chatterbox: `pip install chatterbox-tts` | Wrapper: `scripts/chatterbox-tts.py`

## Current Visual Stack (2026-04-12)
- Light theme (#F5F3EF warm off-white, blue/emerald accents)
- D2 pre-rendered SVG diagrams (Terrastruct, `brew install d2`)
- Chatterbox human voice (primary TTS)
- Avatar bubble (220px, bottom-right, loops stock video or photo)
- Rhubarb lip sync cues (2000+ mouth shapes per video)
- Jarvis HUD overlay (corner brackets, progress ring, scan line)
- Perlin noise wobble on all elements
- Lucide React icons in diagram nodes
- SadTalker being set up for real lip-synced avatar (Python 3.10 venv at tools/sadtalker-env/)

## TTS Priority Chain
```
Chatterbox (human voice, slow on CPU ~10x realtime)
  → Edge TTS PrabhatNeural (fast, sounds AI)
    → Kokoro af_heart (fast, American accent)
      → macOS native (offline fallback)
```

## Content Scale
- 66 topics, 784 sessions, 5,800 questions
- 57 visual templates with 200+ variants
- 50+ topic-specific cinematic intro configs
- 7 hook formulas, 4 open loop patterns

## Rules for Claude
1. **Never re-read files you already know** — use this architecture map
2. **Never research what's already been researched** — check memory files first
3. **Render a 30s preview before full render** — `--frames=150-1050`
4. **All animations must be deterministic** — use seeded noise, never Math.random()
5. **One fix → one test → approve → batch** — no 5 iterations on same video
6. **Minimize token usage** — direct code changes, no planning documents for simple fixes
7. **Props files are at** `output/test-props-s<N>.json` after running render-session.ts
8. **Videos go to** `~/Documents/guru-sishya/<topic>/session-<N>/long/`
9. **Don't rebuild what works** — the pipeline generates good storyboards, TTS works, rendering works
10. **The bottleneck is UPLOAD + THUMBNAILS + TITLES** — not more code changes
