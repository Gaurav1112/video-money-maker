# Indian English Male Voice TTS Research

**Date:** 2026-03-28
**Goal:** Find the best natural-sounding Indian male English voice for the Guru Sishya video pipeline
**Target Sound:** Educated Indian man teaching — think Khan Sir, Striver, or Harkirat Singh

---

## TL;DR — Recommendations

| Tier | Service | Voice ID | Quality | Cost | Word Timestamps |
|------|---------|----------|---------|------|-----------------|
| **1. IMMEDIATE (no signup)** | Edge TTS | `en-IN-PrabhatNeural` | 7/10 | FREE, unlimited | Yes (VTT/SRT) |
| **2. BEST FREE (signup)** | Sarvam AI Bulbul v3 | `Rahul` / `Amit` / `Dev` | 9/10 | Rs 1000 free credits (~333K chars) | No |
| **3. BEST SELF-HOSTED** | Kokoro TTS | `im_nicola` | 8/10 | FREE (self-hosted) | Yes (captioned_speech) |
| **4. BEST PAID** | Google Cloud TTS | `en-IN-Chirp3-HD-Achird` | 9.5/10 | 1M chars/month free (WaveNet) | Yes (SSML timepoints) |
| **5. OPEN SOURCE** | Indic Parler-TTS | Dinesh / Kabir / Tarun | 7.5/10 | FREE (local GPU) | No |

**WINNER for immediate pipeline upgrade: Edge TTS `en-IN-PrabhatNeural` (male)**
It is already integrated. Just switch the default voice from `en-IN-NeerjaNeural` (female) to `en-IN-PrabhatNeural` (male).

---

## Detailed Service Comparison

### 1. Edge TTS (Microsoft) — ALREADY INSTALLED

**Status:** Currently in pipeline at `tts-engine.ts`
**Current default:** `en-IN-NeerjaNeural` (female) — NEEDS TO CHANGE TO MALE

#### Available en-IN Voices (confirmed via `edge-tts --list-voices`)

| Voice ID | Gender | Style | Notes |
|----------|--------|-------|-------|
| `en-IN-PrabhatNeural` | Male | General, Friendly, Positive | **RECOMMENDED** — educated Indian male |
| `en-IN-NeerjaNeural` | Female | General, Friendly, Positive | Currently set as default |
| `en-IN-NeerjaExpressiveNeural` | Female | General, Friendly, Positive | Expressive variant with styles |

#### Details
- **Free tier:** Unlimited (no API key needed, uses Edge's online service)
- **Quality:** 7/10 — Neural quality, clear Indian accent, slightly robotic at times
- **Latency:** 1-3 seconds for short text, 5-10s for long paragraphs
- **Word timestamps:** YES — `--write-subtitles output.vtt` gives word-level VTT/SRT
- **API:** Python CLI (`python3 -m edge_tts`) and async Python API
- **Rate limiting:** Can be throttled if overused (Microsoft's discretion)
- **Integration:** Already done in `tts-engine.ts`, just change voice ID

#### Word Timestamp Support (KEY FEATURE)
```bash
# Generate audio + word-level VTT timestamps
python3 -m edge_tts \
  --voice en-IN-PrabhatNeural \
  --rate=-15% \
  --text "Load balancing distributes traffic across multiple servers" \
  --write-media output.mp3 \
  --write-subtitles output.vtt
```

The VTT file contains word boundary events — perfect for karaoke-style text sync in Remotion.

#### Verdict
Best immediate option. Switch `VOICE_MAP['indian-english']` from `en-IN-NeerjaNeural` to `en-IN-PrabhatNeural` and you have a male Indian voice teaching.

---

### 2. Kokoro TTS (Self-Hosted) — ALREADY INSTALLED

**Status:** Primary TTS in pipeline, falls back to Edge TTS when unavailable

#### Available Indian English Voices

| Voice ID | Gender | Accent | Notes |
|----------|--------|--------|-------|
| `im_nicola` | Male | Indian English | **Current default** — authoritative, Khan Sir style |
| `if_sara` | Female | Indian English | Indian English female |
| `hm_omega` | Male | Hindi | Deep, authoritative tone |
| `hm_psi` | Male | Hindi | Hindi male variant |

#### Details
- **Free tier:** Completely free (self-hosted via Docker)
- **Quality:** 8/10 — Very natural, handles Hinglish well
- **Latency:** 2-5 seconds (depends on GPU/CPU)
- **Word timestamps:** YES — `/dev/captioned_speech` endpoint returns real word-level timestamps
- **API:** REST API at `http://localhost:8880`
- **Requirement:** Docker + ~2GB disk, runs on CPU (slow) or GPU (fast)

#### Verdict
Best quality self-hosted option. Already the primary TTS. The `im_nicola` voice is great for the Khan Sir teaching style. Main drawback: requires Docker running locally.

---

### 3. Sarvam AI — Bulbul v3 (India-First)

**Status:** Not integrated yet

#### Available Male Indian English Voices (12 male voices)

| Speaker Name | Style | Notes |
|-------------|-------|-------|
| `Shubh` | Default | Standard male |
| `Rahul` | Conversational | Natural educator tone |
| `Amit` | Warm | Good for teaching |
| `Dev` | Professional | Clear articulation |
| `Rohan` | Youthful | Energetic delivery |
| `Varun` | Balanced | Good all-rounder |
| `Kabir` | Deep | Authoritative |
| `Aayan` | Modern | Contemporary feel |
| `Ashutosh` | Professional | Corporate style |
| `Advait` | Warm | Soft teaching style |
| `Manan` | Conversational | Casual feel |
| `Ratan` | Mature | Senior educator style |

#### Details
- **Free tier:** Rs 1000 free credits on signup (no credit card required), ~333K characters
- **Pricing:** Rs 30 per 10K characters after free credits
- **Quality:** 9/10 — Best Indian English voices, trained on professional voice artists
- **Latency:** Low (~1-2s via REST, streaming via WebSocket)
- **Word timestamps:** Not mentioned in docs (likely NO)
- **API:** REST API (up to 500 chars) + WebSocket streaming
- **Audio formats:** MP3, WAV, AAC, OPUS, FLAC, PCM, MULAW, ALAW
- **Special:** Handles numbers, dates, currencies, mixed Hindi-English automatically
- **Speed control:** 0.5x to 2.0x
- **Temperature:** 0.01 to 1.0 for expressiveness

#### API Example
```python
import requests

response = requests.post(
    "https://api.sarvam.ai/text-to-speech",
    headers={"api-subscription-key": "YOUR_KEY"},
    json={
        "inputs": ["Load balancing distributes traffic across multiple servers"],
        "target_language_code": "en-IN",
        "speaker": "Rahul",
        "pitch": 0,
        "pace": 0.9,
        "loudness": 1.0,
        "speech_sample_rate": 22050,
        "enable_preprocessing": True,
        "model": "bulbul:v3"
    }
)
# Returns base64 encoded audio
```

#### Verdict
The BEST quality Indian English voices available. Made by Indians, for Indians. However, no word-level timestamps and requires API key + has usage limits. Great for premium/batch renders.

---

### 4. Google Cloud TTS

**Status:** Not integrated

#### Available en-IN Male Voices

| Voice ID | Type | Quality | Free Tier |
|----------|------|---------|-----------|
| `en-IN-Standard-B` | Standard | 5/10 | 4M chars/month |
| `en-IN-Standard-C` | Standard | 5/10 | 4M chars/month |
| `en-IN-Standard-F` | Standard | 5/10 | 4M chars/month |
| `en-IN-Wavenet-B` | WaveNet | 7/10 | 1M chars/month |
| `en-IN-Wavenet-C` | WaveNet | 7/10 | 1M chars/month |
| `en-IN-Wavenet-F` | WaveNet | 7/10 | 1M chars/month |
| `en-IN-Neural2-B` | Neural2 | 8/10 | 1M chars/month |
| `en-IN-Neural2-C` | Neural2 | 8/10 | 1M chars/month |
| `en-IN-Chirp-HD-D` | Chirp HD | 9/10 | Paid only |
| `en-IN-Chirp3-HD-Achird` | Chirp3 HD | 9.5/10 | Paid only |
| `en-IN-Chirp3-HD-Algenib` | Chirp3 HD | 9.5/10 | Paid only |

#### Details
- **Free tier:** 4M chars/month (Standard), 1M chars/month (WaveNet/Neural2) + $300 new customer credit
- **Quality:** Standard=5/10, WaveNet=7/10, Neural2=8/10, Chirp3=9.5/10
- **Latency:** 1-3 seconds
- **Word timestamps:** YES — via SSML `<mark>` tags and timepoint events
- **API:** REST API, gRPC, client libraries (Python, Node.js, Go, Java)
- **Requirement:** Google Cloud account + API key

#### Verdict
Excellent quality and generous free tier. Neural2 voices sound very natural. Chirp3 HD is near-human quality but costs extra. Good backup option with timestamp support.

---

### 5. Azure TTS (Microsoft — same voices as Edge TTS, plus more)

**Status:** Not directly integrated (Edge TTS uses same underlying tech)

#### Available en-IN Male Voices

| Voice ID | Type | Notes |
|----------|------|-------|
| `en-IN-PrabhatNeural` | Neural | Same as Edge TTS |
| `en-IN-AaravNeural` | Neural | NEW — younger male |
| `en-IN-KunalNeural` | Neural | NEW — conversational |
| `en-IN-RehaanNeural` | Neural | NEW — modern style |
| `en-IN-ArjunNeural` | Neural (Bilingual) | NEW — bilingual en-IN/hi-IN, conversational, empathetic |

#### Details
- **Free tier (F0):** 500K characters/month (neural voices)
- **Paid (S0):** $16 per 1M characters
- **Quality:** 7-8/10 — Neural quality, ArjunNeural is bilingual and most natural
- **Latency:** 1-2 seconds
- **Word timestamps:** YES — WordBoundary events via Speech SDK, viseme data available
- **API:** REST API, Speech SDK (Python, JS, C#, Java, Go)
- **Requirement:** Azure account + API key
- **Special:** ArjunNeural handles Hindi-English code-switching natively

#### Key Insight
Azure has MORE en-IN voices than Edge TTS (5 male vs 1 in Edge). `en-IN-ArjunNeural` is the bilingual voice that handles Hinglish switching — this could be the killer feature for teaching content that mixes Hindi and English naturally.

#### Verdict
If you need ArjunNeural (bilingual), sign up for Azure free tier. Otherwise, Edge TTS with PrabhatNeural is sufficient.

---

### 6. ElevenLabs

**Status:** Not integrated

#### Indian Voice Support
- Community voices with Indian accents available
- Voice cloning supported (clone any Indian English speaker)
- Hindi language supported natively

#### Details
- **Free tier:** 10K characters/month (NON-COMMERCIAL, basically a demo)
- **Paid:** Starting $5/month (Starter), $22/month (Creator) for commercial use
- **Quality:** 9.5/10 — Industry-leading natural speech
- **Latency:** 1-3 seconds
- **Word timestamps:** YES — available via API
- **API:** REST API, Python SDK, WebSocket streaming
- **Voice cloning:** Yes, with just a few minutes of audio

#### Verdict
Best absolute quality, but free tier is too small (10K chars = ~3 minutes of audio) and prohibits commercial use. Only worth it if budget allows $22+/month.

---

### 7. MeloTTS (Open Source by MyShell.ai)

**Status:** Not integrated

#### Indian English Voice
| Speaker ID | Accent | Quality |
|-----------|--------|---------|
| `EN_INDIA` | Indian English | 6.5/10 |

#### Details
- **Free tier:** Completely free, open source (MIT License)
- **Quality:** 6.5/10 — Decent but less natural than neural cloud services
- **Latency:** Real-time on CPU
- **Word timestamps:** No native support
- **API:** Python API, CLI (`melo` command)
- **Requirement:** `pip install melotts`, ~500MB model download

#### Usage
```python
from melo.api import TTS
model = TTS(language='EN', device='auto')
speaker_ids = model.hps.data.spk2id
model.tts_to_file("Hello world", speaker_ids['EN_INDIA'], 'output.wav', speed=0.9)
```

#### Verdict
Free and local, but quality is noticeably below Edge TTS and Kokoro. Use as offline fallback only.

---

### 8. Indic Parler-TTS (Open Source by AI4Bharat + HuggingFace)

**Status:** Not integrated

#### Available English Male Voices
| Speaker | Style | Notes |
|---------|-------|-------|
| Dinesh | Natural | Indian English male |
| Jatin | Clear | Indian English male |
| Aakash | Conversational | Indian English male |
| Kabir | Deep | Indian English male |
| Tarun | Professional | Indian English male |
| Raghav | Warm | Indian English male |
| Ravi | Standard | Indian English male |
| Vikas | Modern | Indian English male |

#### Details
- **Free tier:** Completely free, open source
- **Quality:** 7.5/10 — Good for Indian languages, decent for English
- **Model size:** 0.9B parameters (~2-4GB VRAM)
- **Word timestamps:** No
- **API:** Python (HuggingFace transformers)
- **Special:** Fine control via natural language descriptions ("A deep male voice speaking slowly and clearly")

#### Usage
```python
from parler_tts import ParlerTTSForConditionalGeneration
from transformers import AutoTokenizer
import soundfile as sf

model = ParlerTTSForConditionalGeneration.from_pretrained("ai4bharat/indic-parler-tts").to("cuda")
tokenizer = AutoTokenizer.from_pretrained("ai4bharat/indic-parler-tts")
desc_tokenizer = AutoTokenizer.from_pretrained(model.config.text_encoder._name_or_path)

description = "Kabir speaks with a deep, authoritative Indian English accent at a moderate pace. The recording is very clear."
prompt = "Load balancing distributes incoming traffic across multiple servers."

desc_ids = desc_tokenizer(description, return_tensors="pt").to("cuda")
prompt_ids = tokenizer(prompt, return_tensors="pt").to("cuda")

audio = model.generate(
    input_ids=desc_ids.input_ids,
    attention_mask=desc_ids.attention_mask,
    prompt_input_ids=prompt_ids.input_ids
).cpu().numpy().squeeze()

sf.write("output.wav", audio, model.config.sampling_rate)
```

#### Verdict
Best open-source option for truly Indian-sounding voices. Requires GPU for reasonable speed. No timestamps is a problem for video sync.

---

### 9. Piper TTS

**Status:** No en-IN voices available

Piper has voices for en-US and en-GB but **NO dedicated Indian English (en-IN) model**. Skip.

---

### 10. Narakeet

**Status:** Not integrated

#### Indian English Voices
- 52 Indian accent English voices (male + female)
- Cannot identify specific voice IDs from research

#### Details
- **Free tier:** Free preview (no download), 20 slides of narrated content trial
- **Paid:** Starting $6/30 minutes ($0.20/min) — pay per audio duration
- **Quality:** 7/10 — Good variety, uses Azure/Google voices under the hood
- **Word timestamps:** Not mentioned
- **API:** REST API available on paid plans

#### Verdict
Mostly a wrapper around cloud TTS services. Not cost-effective vs using Edge TTS or Google Cloud directly.

---

## Feature Comparison Matrix

| Feature | Edge TTS | Kokoro | Sarvam | Google Cloud | Azure | ElevenLabs |
|---------|----------|--------|--------|-------------|-------|------------|
| **Cost** | FREE | FREE (self-hosted) | Rs 1000 free | 1M chars free | 500K chars free | 10K chars free |
| **Indian Male Voice** | PrabhatNeural | im_nicola | 12 choices | 6+ choices | 5 choices | Community voices |
| **Quality** | 7/10 | 8/10 | 9/10 | 8-9.5/10 | 7-8/10 | 9.5/10 |
| **Word Timestamps** | VTT/SRT | captioned_speech | No | SSML marks | WordBoundary | Yes |
| **Latency** | 1-3s | 2-5s | 1-2s | 1-3s | 1-2s | 1-3s |
| **Offline** | No | Yes | No | No | No | No |
| **API Key Needed** | No | No | Yes | Yes | Yes | Yes |
| **Hinglish Support** | Decent | Good | Excellent | Decent | ArjunNeural=Excellent | Good |
| **Commercial Use** | Yes | Yes | Yes | Yes | Yes | Paid only |

---

## Implementation Plan

### Phase 1: Immediate (0 effort) — Switch Edge TTS voice to male

Change in `tts-engine.ts`:
```typescript
// BEFORE
'indian-english': 'en-IN-NeerjaNeural',  // Female

// AFTER
'indian-english': 'en-IN-PrabhatNeural',  // Male — educated Indian teacher
```

Also update Edge TTS to generate VTT timestamps for better word sync:
```typescript
// Add --write-subtitles flag to edgeTTS function
execFileSync('python3', [
  '-m', 'edge_tts',
  '--voice', voice,
  '--rate=-15%',
  '--text', cleanText,
  '--write-media', audioPath,
  '--write-subtitles', audioPath.replace('.mp3', '.vtt'),  // NEW
], { timeout: 60000 });
```

### Phase 2: Short-term — Add Sarvam AI as premium TTS provider

1. Sign up at sarvam.ai (free Rs 1000 credits)
2. Add `sarvamTTS()` function in tts-engine.ts
3. Use for final/premium renders (best Indian voice quality)
4. Recommended voice: `Rahul` or `Amit` for teaching content

### Phase 3: Medium-term — Azure TTS for bilingual content

1. Sign up for Azure free tier (500K chars/month)
2. Use `en-IN-ArjunNeural` for Hinglish content (bilingual Hindi+English)
3. Leverage WordBoundary events for precise word timestamps

### Phase 4: Long-term — Voice cloning

1. Record 5-10 minutes of ideal teacher voice (or use Khan Sir/Striver clips for reference style)
2. Clone via ElevenLabs ($22/month) or fine-tune XTTS v2 (free, self-hosted)
3. Use cloned voice for consistent brand identity

---

## Edge TTS Timestamp Integration (Ready to implement)

The key missing piece in the current pipeline is using Edge TTS's native VTT timestamps instead of proportional estimates. Here is the updated `edgeTTS` function:

```typescript
async function edgeTTS(
  text: string,
  cacheKey: string,
  outputName?: string,
  voiceLanguage: string = 'indian-english'
): Promise<TTSResult> {
  const { execFileSync } = await import('child_process');

  const filename = outputName || `edge_${cacheKey.slice(0, 12)}.mp3`;
  const audioPath = path.join(AUDIO_DIR, filename);
  const vttPath = audioPath.replace('.mp3', '.vtt');

  const cleanText = text.replace(/"/g, '\\"').slice(0, 3000);
  const voice = process.env.EDGE_TTS_VOICE || VOICE_MAP[voiceLanguage] || VOICE_MAP['indian-english'];

  execFileSync('python3', [
    '-m', 'edge_tts',
    '--voice', voice,
    '--rate=-15%',
    '--text', cleanText,
    '--write-media', audioPath,
    '--write-subtitles', vttPath,   // Get word-level timestamps!
  ], { timeout: 60000 });

  // Parse VTT for real word timestamps
  let wordTimestamps: Array<{ word: string; start: number; end: number }> = [];
  let duration = 0;

  if (fs.existsSync(vttPath)) {
    const vttContent = fs.readFileSync(vttPath, 'utf-8');
    wordTimestamps = parseVttTimestamps(vttContent);
    if (wordTimestamps.length > 0) {
      duration = wordTimestamps[wordTimestamps.length - 1].end;
    }
    fs.unlinkSync(vttPath);  // Cleanup
  }

  // Fallback to file-size estimation if VTT parsing fails
  if (duration === 0) {
    const stats = fs.statSync(audioPath);
    duration = stats.size / 12000;
    wordTimestamps = makeTimestampsProportional(text, duration);
  }

  const result: TTSResult = { audioPath, wordTimestamps, duration };
  cache.set(cacheKey, result);
  console.log(`  OK Edge TTS (${voice}): ${filename} (${duration.toFixed(1)}s, ${wordTimestamps.length} words)`);
  return result;
}
```

---

## Final Recommendation

**For the Guru Sishya video pipeline RIGHT NOW:**

1. **Switch Edge TTS default to `en-IN-PrabhatNeural`** (male Indian voice) — zero effort, immediate improvement
2. **Enable VTT timestamp parsing** from Edge TTS — better word sync than proportional estimates
3. **Keep Kokoro `im_nicola` as primary** when Docker is running — best self-hosted quality
4. **Add Sarvam AI later** for premium batch renders — best Indian voice quality overall

The pipeline already has the perfect fallback chain: Kokoro (best) -> Edge TTS (free) -> macOS (offline) -> Silent. Just need to flip the gender from female to male.

---

## Sources

- [Edge TTS GitHub](https://github.com/rany2/edge-tts)
- [Edge TTS PyPI](https://pypi.org/project/edge-tts/)
- [Azure New Indian Voices Announcement](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/announcing-ga-of-new-indian-voices/4247044)
- [Sarvam AI TTS API](https://www.sarvam.ai/apis/text-to-speech)
- [Sarvam AI Pricing](https://www.sarvam.ai/api-pricing)
- [Sarvam Bulbul v3 Blog](https://www.sarvam.ai/blogs/bulbul-v3)
- [Google Cloud TTS Voices](https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types)
- [Google Cloud TTS Pricing](https://cloud.google.com/text-to-speech/pricing)
- [Azure TTS Language Support](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support)
- [Azure TTS Free Tier Limits](https://learn.microsoft.com/en-us/answers/questions/1663093/azure-text-to-speech-f0-(free)-tier-limits)
- [ElevenLabs Pricing](https://elevenlabs.io/pricing)
- [ElevenLabs Review 2026](https://www.roborhythms.com/elevenlabs-review-2026/)
- [Indic Parler-TTS (HuggingFace)](https://huggingface.co/ai4bharat/indic-parler-tts)
- [MeloTTS GitHub](https://github.com/myshell-ai/MeloTTS)
- [Narakeet Indian Voices](https://www.narakeet.com/languages/indian-accent-text-to-speech/)
- [Narakeet Pricing](https://www.narakeet.com/docs/pricing/)
- [Coqui XTTS v2](https://huggingface.co/coqui/XTTS-v2)
- [Piper TTS Voices](https://huggingface.co/rhasspy/piper-voices)
- [PlayHT Review 2026](https://kripeshadwani.com/playht-review/)
- [ttsMP3.com Indian English](https://ttsmp3.com/text-to-speech/Indian%20English/)
- [TTSFree.com English India](https://ttsfree.com/text-to-speech/english-india)
