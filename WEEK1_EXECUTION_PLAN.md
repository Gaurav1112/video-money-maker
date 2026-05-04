# ⚡ WEEK 1 EXECUTION PLAN (FULL FORCE)

**Goal:** Get first B-Roll + Micro-Shock videos rendering and uploaded by Friday 5 May EOD

## 🔴 CRITICAL FIRST: FIX WORKFLOW

**Problem:** Workflow #25323446211 stuck in PENDING

**Solution (Based on prior knowledge):**
1. Self-hosted runner may be offline
2. Try ubuntu-latest for render phase as fallback
3. Check YouTube OAuth2 secrets are set
4. Enable debug logging

```bash
# Check runner status
gh api repos/Gaurav1112/video-money-maker/actions/runners

# Cancel stuck workflow
gh run cancel 25323446211 --repo Gaurav1112/video-money-maker

# Trigger new workflow with debugging
gh workflow run complete-render-publish.yml --repo Gaurav1112/video-money-maker -f debug=true
```

## 🎬 PARALLEL WORK TRACKS

### Track 1: B-Roll Library (5 days effort)
**Deliverable:** 20 stock clips curated + integrated into render pipeline

```bash
# Create B-roll management structure
mkdir -p src/stock/broll-library
cat > src/stock/broll-library/manifest.json << 'MANIFEST'
{
  "clips": [
    {
      "id": "kb-load-balancer-01",
      "topic": "Load Balancing",
      "url": "https://mixkit.co/video/...",
      "duration": 15,
      "format": "mp4",
      "credit": "Mixkit"
    },
    {
      "id": "kb-database-01",
      "topic": "Database",
      "url": "https://mixkit.co/video/...",
      "duration": 12,
      "format": "mp4",
      "credit": "Mixkit"
    }
    ...
  ]
}
MANIFEST

# Integrate into render pipeline
npm run render:stock -- --storyboard /tmp/quick-storyboard.json --out ~/guru-sishya-uploads/b-roll-test --enable-broll
```

### Track 2: Micro-Shock Visuals (3 days effort)
**Deliverable:** Remotion component that renders [WRONG] vs [RIGHT] opener

```bash
# Create shock visuals component
mkdir -p src/components/shock-visuals
cat > src/components/shock-visuals/ShockOpener.tsx << 'COMPONENT'
import React from 'react';
import { AbsoluteFill, Sequence, Text } from 'remotion';

export const ShockOpener: React.FC<{
  wrong: string;
  right: string;
  durationFrames?: number;
}> = ({ wrong, right, durationFrames = 90 }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Sequence from={0} durationInFrames={durationFrames}>
        <AbsoluteFill style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          {/* WRONG side */}
          <div style={{ background: '#ff6b6b', padding: 40, display: 'flex', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 32, fontWeight: 'bold' }}>
              ❌ WRONG: {wrong}
            </Text>
          </div>
          {/* RIGHT side */}
          <div style={{ background: '#51cf66', padding: 40, display: 'flex', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 32, fontWeight: 'bold' }}>
              ✅ RIGHT: {right}
            </Text>
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
COMPONENT

# Write failing test FIRST (TDD)
cat > tests/shock-visuals/opener.test.ts << 'TEST'
import { renderShockOpener } from '../../src/components/shock-visuals/ShockOpener';

describe('Shock Opener', () => {
  test('renders 3 second WRONG vs RIGHT comparison', async () => {
    const video = await renderShockOpener({
      wrong: 'Most use REST APIs',
      right: 'gRPC is faster',
    });
    expect(video.durationMs).toBe(3000);
  });
  
  test('has dual pane layout (WRONG left, RIGHT right)', () => {
    const layout = getLayout();
    expect(layout.gridCols).toBe(2);
    expect(layout.leftLabel).toContain('❌');
    expect(layout.rightLabel).toContain('✅');
  });
});
TEST

# Run test (it will fail)
npm run test -- tests/shock-visuals/opener.test.ts

# Implement component to pass test
npm run render:stock -- --with-shock-opener
```

### Track 3: Render & Upload Flow (Today)
**Deliverable:** At least 1 video from storyboard → YouTube

```bash
# Step 1: Quick render (no B-roll yet, just test flow)
npx tsx scripts/render-stock-short.ts \
  --storyboard ./tests/fixtures/demo-storyboard.json \
  --out ~/guru-sishya-uploads/test-render-1 \
  --allow-silent-fallback=true

# Step 2: Verify MP4 was created
ls -lh ~/guru-sishya-uploads/test-render-1/*.mp4

# Step 3: Upload to YouTube (test OAuth2)
export YOUTUBE_CLIENT_ID="$(gh secret list --repo Gaurav1112/video-money-maker --json name,value -q '.[] | select(.name=="YOUTUBE_CLIENT_ID") | .value')"
export YOUTUBE_CLIENT_SECRET="$(gh secret list --repo Gaurav1112/video-money-maker --json name,value -q '.[] | select(.name=="YOUTUBE_CLIENT_SECRET") | .value')"
export YOUTUBE_REFRESH_TOKEN_HI="$(gh secret list --repo Gaurav1112/video-money-maker --json name,value -q '.[] | select(.name=="YOUTUBE_REFRESH_TOKEN") | .value')"

npx tsx scripts/upload-youtube.ts \
  --file="~/guru-sishya-uploads/test-render-1/video.mp4" \
  --title="[TEST] System Design: Load Balancing" \
  --description="Quick test upload from local render" \
  --tags="system-design,test" \
  --channel="hi" \
  --publish

# Step 4: Verify video appeared on channel
# Check: https://www.youtube.com/@GuruSishya-India/videos
```

### Track 4: Workflow Fix (Parallel)
**Deliverable:** Workflow runs successfully, renders 1 video, uploads to YouTube automatically

```bash
# Step 1: Check runner status
gh api repos/Gaurav1112/video-money-maker/actions/runners --jq '.runners[] | {name, status}'

# Step 2: If self-hosted is offline, use ubuntu-latest + GPU runner
# Edit: .github/workflows/complete-render-publish.yml
# Change batch-render job: runs-on: ubuntu-latest (not self-hosted)

# Step 3: Test OAuth2 token refresh in workflow
# Add to publish phase:
cat >> .github/workflows/complete-render-publish.yml << 'WORKFLOW'
      - name: Test YouTube Token Refresh
        run: |
          npx tsx -e "
          const ytapi = require('./src/lib/youtube-api.ts');
          const token = await ytapi.refreshToken(process.env.YOUTUBE_REFRESH_TOKEN_HI);
          console.log('✅ Token refreshed successfully');
          "
WORKFLOW

# Step 4: Trigger workflow
gh workflow run complete-render-publish.yml --repo Gaurav1112/video-money-maker
gh run watch $(gh run list --workflow complete-render-publish.yml --repo Gaurav1112/video-money-maker --limit 1 --json databaseId -q '.[0].databaseId')
```

## 📋 DAILY CHECKLIST (Monday 5 May)

- [ ] Fix workflow (debug why pending)
- [ ] Render 1 test video (local)
- [ ] Upload to YouTube manually
- [ ] Verify: Video appears on channel
- [ ] Measure: CTR, watch time at 1h, 6h, 24h marks
- [ ] Create B-Roll library manifest (20 clips)
- [ ] Implement Shock Opener component (TDD)
- [ ] Render 3 videos with new components
- [ ] Upload all 3 to YouTube
- [ ] Update todos: Mark in_progress → done as each item completes

## 🎯 SUCCESS CRITERIA (EoW)

✅ Workflow running successfully (no more PENDING)
✅ At least 1 video with B-roll test clips
✅ At least 2 videos with shock opener visuals
✅ YouTube upload automation working (both manual + workflow)
✅ Baseline metrics captured (CTR, retention, engagement)
✅ B-Roll library checklist created (ready for week 2)
✅ All Week 1 todos marked in_progress or done

## 🚀 GO LIVE TIMELINE

**Today (Mon 5 May):** 
- Fix workflow + render 1 test video

**Tomorrow-Wed (Tue-Wed):**
- Render B-roll test videos (3-5)
- Refine shock visuals template
- Measure engagement vs baseline

**Thu-Fri (Thu-Fri):**
- Polish B-roll library (finalize 20 clips)
- Record 5 production videos with new assets
- Upload all 5 by Friday EOD

**Week 2:**
- Continue B-roll + shock visuals
- Add war stories template
- Launch new content roadmap

