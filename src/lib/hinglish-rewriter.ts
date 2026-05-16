/**
 * hinglish-rewriter.ts
 *
 * Deterministic, rule-based English → Hinglish text transform pipeline.
 *
 * Design principles:
 *   1. DETERMINISTIC — given the same input, always produces the same output.
 *      No LLM API calls. Safe for CI/CD without network dependencies.
 *   2. CONSERVATIVE — only transforms narration vocabulary and sentence connectives.
 *      Tech terms, code examples, and proper nouns are preserved in English.
 *   3. EXTENSIBLE — the PHRASE_MAP and CONNECTIVE_MAP tables are the only things
 *      that need updating as the vocabulary library grows.
 *
 * ── OLLAMA_UPGRADE_SLOT ────────────────────────────────────────────────────
 * When LLM quality is needed, replace ruleBasedTransform() with:
 *
 *   import Groq from 'groq-sdk';
 *   const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
 *   const resp = await groq.chat.completions.create({
 *     model: 'llama-3.3-70b-versatile',   // free: 1000 req/day, 100K tok/day
 *     messages: [
 *       { role: 'system', content: HINGLISH_SYSTEM_PROMPT },
 *       { role: 'user',   content: englishText },
 *     ],
 *   });
 *   return resp.choices[0].message.content;
 *
 * Or for offline/self-hosted:
 *   import ollama from 'ollama';
 *   const resp = await ollama.chat({ model: 'llama3.1:8b', messages: [...] });
 * ──────────────────────────────────────────────────────────────────────────
 */

// ---------------------------------------------------------------------------
// Vocabulary maps
// ---------------------------------------------------------------------------

/**
 * Common English teaching phrases → Hinglish equivalents.
 * Sorted longest-first to avoid partial-match shadowing.
 *
 * Register: conversational, desi-teacher style (think Striver / HiteshChoudhary).
 * NOT formal Hindi — real code-switching as Indian devs speak.
 */
export const PHRASE_MAP: ReadonlyArray<[string | RegExp, string]> = [
  // ── Hooks & openers ────────────────────────────────────────────────────
  [/^Today we('re going to| will) (learn|understand|explore|cover)/i,
    "Aaj hum samjhenge"],
  [/^In this video[,]? (we('ll| will)|I('ll| will))/i,
    "Is video mein hum"],
  [/^Let('s| us) (start|begin) (with|by)/i,
    "Chaliye shuru karte hain"],
  [/^Before we (start|begin|dive in)/i,
    "Shuru karne se pehle"],
  [/^Have you ever wondered/i,
    "Kabhi socha hai aapne"],
  [/^Most (engineers|developers|people) (get this wrong|don't know|don't understand)/i,
    "Zyaadatar developers ye galat samajhte hain"],
  [/^The number one (mistake|problem|issue)/i,
    "Sabse badi galti"],
  [/^Here's the thing[:.]/i,
    "Baat ye hai ki"],
  [/^Here is the thing[:.]/i,
    "Baat ye hai ki"],

  // ── Explanation connectives ────────────────────────────────────────────
  [/\bthink of (it|this) as\b/gi,
    "ise aise samjho"],
  [/\bthink of (it|this) like\b/gi,
    "ye bilkul aise hai jaise"],
  [/\bfor example[,]?\b/gi,
    "for example"],                    // keep English — universally understood
  [/\bin other words\b/gi,
    "matlab ye hai ki"],
  [/\bto put it simply\b/gi,
    "simple bhasha mein"],
  [/\blet me explain\b/gi,
    "main explain karta hoon"],
  [/\bthe key (point|idea|insight) (here |is )/gi,
    "sabse important baat ye hai ki "],
  [/\bthe bottom line (is|here is)\b/gi,
    "conclusion ye hai ki"],
  [/\bwhat this means (is|for us)\b/gi,
    "iska matlab hai ki"],
  [/\bnow, (let's|let us)\b/gi,
    "ab chaliye"],
  [/\bso, (what|how|why)\b/gi,
    "toh, $2"],

  // ── Common teaching phrases ────────────────────────────────────────────
  [/\bYou might be wondering\b/gi,
    "Aap soch rahe honge"],
  [/\bGreat question[.!]/gi,
    "Bahut accha sawaal hai!"],
  [/\bRemember,?\s*/gi,
    "Yaad rakho, "],
  [/\bPro tip[:.]\b/gi,
    "Pro tip:"],
  [/\bWatch out for\b/gi,
    "Dhyan rakhna"],
  [/\bThis is (very |really |super )?important\b/gi,
    "Ye bahut important hai"],
  [/\bAt the end of the day\b/gi,
    "Aakhir mein"],
  [/\bLet's take a step back\b/gi,
    "Ek baar peeche jaate hain"],
  [/\bImagine you('re| are)\b/gi,
    "Socho aap"],
  [/\bImagine (a|an|the)\b/gi,
    "Socho ek"],

  // ── Evaluative phrases ─────────────────────────────────────────────────
  [/\bThis is (a )?(really |very |super )?simple\b/gi,
    "Ye bilkul simple hai"],
  [/\bThis is (a )?(really |very |super )?complex\b/gi,
    "Ye thoda complex hai"],
  [/\bThis is (a )?(really |very |super )?powerful\b/gi,
    "Ye bahut powerful concept hai"],
  [/\bThis is (a )?(really |very |super )?common (mistake|issue|bug)\b/gi,
    "Ye ek bahut common $3 hai"],
  [/\bEasy, right\?/gi,
    "Simple hai na?"],
  [/\bMakes sense\?/gi,
    "Samajh aaya?"],
  [/\bDoes that make sense\?/gi,
    "Ye samajh aaya?"],

  // ── Sequence markers ───────────────────────────────────────────────────
  [/\bFirst[,]? (of all[,]? )?let('s| us)\b/gi,
    "Pehle"],
  [/\bSecond[,]? (let's|let us)\b/gi,
    "Dusra"],
  [/\bThird[,]? (let's|let us)\b/gi,
    "Teesra"],
  [/\bFinally[,]\b/gi,
    "Aakhir mein,"],
  [/\bTo summarize[,:]?\b/gi,
    "Summary yeh hai ki"],
  [/\bTo recap[,:]?\b/gi,
    "Recap karte hain —"],
  [/\bLet's (now |)move on to\b/gi,
    "Ab chalte hain"],
  [/\bMoving on[,]\b/gi,
    "Aage chalte hain,"],
  [/\bBefore (we |)wrap up\b/gi,
    "Khatam karne se pehle"],
  [/\bThat's (it|all) for (today|this video)[.!]?/gi,
    "Bas, itna hi aaj ke liye!"],

  // ── Interview / FAANG prep hooks (high-value for Indian audience) ──────
  [/\bIn (a |your |an )?interview[,]?\b/gi,
    "Interview mein"],
  [/\bFor (your |the )?interview[,]?\b/gi,
    "Interview ke liye"],
  [/\bIf (an |your )?interviewer asks\b/gi,
    "Agar interviewer pooche"],
  [/\bWhen (you |the )?interviewer asks\b/gi,
    "Jab interviewer pooche"],
  [/\bThis (is|comes up) (very )?(often|frequently) in interviews\b/gi,
    "Ye interview mein bahut baar aata hai"],
  [/\bA common interview question (is|asks)\b/gi,
    "Ek common interview question hai —"],
  [/\bYour (FAANG|tech|software) (interview|prep)\b/gi,
    "aapka $1 interview"],

  // ── Desi-specific encouragement ────────────────────────────────────────
  [/\bDon't worry,?\s*/gi,
    "Ghabraao mat, "],
  [/\bYou('ve| have) got this[.!]/gi,
    "Aap kar sakte ho!"],
  [/\bTrust me,?\s*/gi,
    "Mujh par bharosa rakho, "],
  [/\bBelieve me,?\s*/gi,
    "Main bol raha hoon, "],
  [/\bThis will (really |definitely )?(help|save) you\b/gi,
    "Ye aapke bahut kaam aayega"],
];

/**
 * Sentence-opening connectives: transform "And ...", "But ...", "So ..." etc.
 * Applied before PHRASE_MAP for cleaner output.
 */
export const CONNECTIVE_MAP: ReadonlyArray<[RegExp, string]> = [
  [/^And (now|then)[,]? /i, "Aur ab "],
  [/^But (wait|here)[,]? /i, "Lekin "],
  [/^So (what|how|why|if)\b/i, "Toh $1"],
  [/^Now, (the question is|let's ask)\b/i, "Ab sawaal ye hai ki"],
  [/^The (good|great) news is[,]?\b/i, "Acchi baat ye hai ki"],
  [/^The (bad|unfortunate) news is[,]?\b/i, "Buri baat ye hai ki"],
];

/**
 * Indian-market analogies: replaces generic Western examples with
 * relatable Indian-context analogies. Applied after PHRASE_MAP.
 *
 * Inspired by the ANALOGY_BANK already partially in the pipeline
 * (specialist-findings.md: "Priya, a chai shop owner on MG Road").
 */
export const ANALOGY_MAP: ReadonlyArray<[RegExp, string]> = [
  // Replace generic "coffee shop" analogy with chai stall
  [/\ba coffee shop\b/gi, "ek chai ki dukaan"],
  [/\bthe coffee shop\b/gi, "woh chai ki dukaan"],
  [/\ba restaurant (queue|line|waitlist)\b/gi, "ek dhaba ki queue"],
  // Replace "post office" with IRCTC/India Post
  [/\ba post office\b/gi, "India Post jaisi service"],
  // Replace "bank" (generic) with Indian context where appropriate
  [/\ba bank (branch|ATM)\b/gi, "ek SBI branch"],
  // Replace "highway" with Indian roads
  [/\ba highway\b/gi, "ek expressway"],
  // Replace "pizza delivery" with Swiggy/Zomato
  [/\bpizza delivery\b/gi, "Swiggy delivery"],
  [/\bfood delivery\b/gi, "Swiggy ya Zomato delivery"],
  // Replace "e-commerce" with Flipkart for Indian resonance
  [/\ban e-commerce (site|platform|store)\b/gi, "Flipkart jaisi site"],
  // Train ticket booking — classic Indian scale story
  [/\bonline ticket booking\b/gi, "IRCTC ticket booking"],
];

// ---------------------------------------------------------------------------
// Transform pipeline
// ---------------------------------------------------------------------------

export interface RewriteOptions {
  /** Apply CONNECTIVE_MAP sentence-opener transforms. Default: true */
  transformConnectives?: boolean;
  /** Apply ANALOGY_MAP Indian context substitutions. Default: true */
  indianAnalogies?: boolean;
  /**
   * Preserve sentences containing code blocks (backtick-delimited) verbatim.
   * Default: true
   */
  preserveCodeBlocks?: boolean;
}

export interface RewriteResult {
  original: string;
  hinglish: string;
  /** Number of substitutions applied */
  substitutionCount: number;
}

/**
 * Transforms a single English sentence into Hinglish using rule-based
 * substitution. Deterministic — no randomness, no LLM.
 *
 * NOTE: This is the OLLAMA_UPGRADE_SLOT. When LLM quality is desired,
 * replace this function body with an async LLM call (see file header).
 */
export function transformSentence(
  sentence: string,
  options: RewriteOptions = {}
): { result: string; count: number } {
  const { transformConnectives = true, indianAnalogies = true } = options;

  // Skip sentences with code blocks entirely
  if (options.preserveCodeBlocks !== false && /`[^`]+`/.test(sentence)) {
    return { result: sentence, count: 0 };
  }

  let result = sentence;
  let count = 0;

  // 1. Connective transforms (sentence starters)
  if (transformConnectives) {
    for (const [pattern, replacement] of CONNECTIVE_MAP) {
      const before = result;
      result = result.replace(pattern, replacement);
      if (result !== before) count++;
    }
  }

  // 2. Phrase substitutions
  for (const [pattern, replacement] of PHRASE_MAP) {
    const before = result;
    result = result.replace(pattern as RegExp, replacement);
    if (result !== before) count++;
  }

  // 3. Indian analogy substitutions
  if (indianAnalogies) {
    for (const [pattern, replacement] of ANALOGY_MAP) {
      const before = result;
      result = result.replace(pattern, replacement);
      if (result !== before) count++;
    }
  }

  return { result, count };
}

/**
 * Splits text into sentences, transforms each, then rejoins.
 * Sentence boundary: period/exclamation/question followed by space or end.
 *
 * Preserves paragraph breaks (double newlines) to keep scene structure intact.
 */
export function rewrite(text: string, options: RewriteOptions = {}): RewriteResult {
  const paragraphs = text.split(/\n{2,}/);
  let totalCount = 0;

  const transformedParagraphs = paragraphs.map((para) => {
    // Split into sentences (naively, but sufficient for narration text)
    const sentences = para.split(/(?<=[.!?])\s+/);
    return sentences
      .map((s) => {
        const { result, count } = transformSentence(s, options);
        totalCount += count;
        return result;
      })
      .join(" ");
  });

  return {
    original: text,
    hinglish: transformedParagraphs.join("\n\n"),
    substitutionCount: totalCount,
  };
}

// ---------------------------------------------------------------------------
// Scene-level rewriter (matches pipeline SessionInput.scenes shape)
// ---------------------------------------------------------------------------

export interface SceneInput {
  narration: string;
  [key: string]: unknown;
}

/**
 * Rewrites all scene narrations in a SessionInput-like scenes array.
 * Non-narration fields pass through untouched.
 */
export function rewriteScenes(
  scenes: SceneInput[],
  options: RewriteOptions = {}
): SceneInput[] {
  return scenes.map((scene) => ({
    ...scene,
    narration: rewrite(scene.narration, options).hinglish,
  }));
}

// ---------------------------------------------------------------------------
// Hook rewriter — Hinglish-first hooks for Indian audience
// ---------------------------------------------------------------------------

/**
 * Indian-market hook templates that replace Hormozi-style English hooks.
 * These are the hooks that stop the scroll on Instagram India.
 *
 * Usage: pick one based on content type.
 */
export const HINGLISH_HOOKS = {
  interview: [
    "Kal interview hai? Ye 3 cheezein yaad kar le 🔥",
    "FAANG interview clear karna hai? Ye concept pehle samajh",
    "Interviewer ye poochhe toh kya bologe? Abhi seekh lo",
    "Ye galti mat karna interview mein — bahut common hai",
  ],
  concept: [
    "Bhai, ye concept bahut important hai — ek baar dekh le",
    "Ye samajh gaya toh system design ke 80% questions clear",
    "Zyaadatar developers ye galat samajhte hain — aap mat karna",
    "Ye cheez college mein nahi sikhate — main sikhata hoon",
  ],
  architecture: [
    "Socho — agar ek billion users ek saath request bhejein, toh tera server kya karega?",
    "Netflix aur Flipkart ka system design alag kyun hai? Abhi batata hoon",
    "WhatsApp ke engineers ne ye problem aise solve ki — dekho",
  ],
  general: [
    "Bhai sun — ye ek cheez yaad rakh, kaafi kaam aayegi",
    "Junior se Senior developer banna hai? Ye concept must-know hai",
    "5 saal pehle ye jaanta toh alag hota — ab tum seekh lo",
  ],
} as const;

export type HookCategory = keyof typeof HINGLISH_HOOKS;

/**
 * Returns the first hook for a given category (deterministic — index 0).
 * For variety, the caller can pass a session-derived index.
 */
export function getHinglishHook(category: HookCategory, index: number = 0): string {
  const hooks = HINGLISH_HOOKS[category];
  return hooks[index % hooks.length];
}
