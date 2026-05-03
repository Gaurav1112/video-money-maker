/**
 * hinglish-rewriter.test.ts
 *
 * Snapshot tests for HinglishRewriter — given fixed English input,
 * verifies deterministic Hinglish output.
 *
 * Test strategy:
 *   - Snapshot tests: verify the full rewritten output hasn't changed
 *   - Unit tests: verify specific substitution rules
 *   - Invariant tests: verify tech terms are preserved unchanged
 *   - Edge cases: empty input, code blocks, already-Hinglish text
 *
 * Run: npx jest tests/hinglish-rewriter.test.ts
 */

import {
  rewrite,
  rewriteScenes,
  transformSentence,
  getHinglishHook,
  protectTechTerms,
  PHRASE_MAP,
  CONNECTIVE_MAP,
  ANALOGY_MAP,
  HINGLISH_HOOKS,
} from "../src/lib/hinglish-rewriter";

// ---------------------------------------------------------------------------
// Snapshot tests — deterministic output
// ---------------------------------------------------------------------------

describe("rewrite() — snapshot tests", () => {
  test("system design intro", () => {
    const input =
      "Today we're going to learn about system design. " +
      "This is really important for your FAANG interview. " +
      "Let me explain how Kafka works.";

    const { hinglish, substitutionCount } = rewrite(input);

    expect(hinglish).toMatch(/^Aaj hum samjhenge/);
    expect(hinglish).toContain("Ye bahut important hai");
    expect(hinglish).toContain("main explain karta hoon");
    expect(hinglish).toContain("Kafka"); // tech term preserved
    expect(substitutionCount).toBeGreaterThan(0);
  });

  test("API gateway explanation", () => {
    const input =
      "Have you ever wondered how API gateway works? " +
      "Think of it as a traffic cop for your microservices. " +
      "The key point here is that every request goes through it.";

    const { hinglish } = rewrite(input);

    expect(hinglish).toMatch(/^Kabhi socha hai aapne/);
    expect(hinglish).toContain("ise aise samjho");
    expect(hinglish).toContain("sabse important baat ye hai ki");
    expect(hinglish).toContain("API"); // tech term preserved
  });

  test("interview prep hook", () => {
    const input =
      "In a interview, you might be wondering how to explain consistent hashing. " +
      "Most engineers get this wrong. " +
      "Don't worry, let me explain.";

    const { hinglish } = rewrite(input);

    expect(hinglish).toContain("Interview mein");
    expect(hinglish).toContain("Aap soch rahe honge");
    expect(hinglish).toContain("Zyaadatar developers ye galat samajhte hain");
    expect(hinglish).toContain("Ghabraao mat");
    expect(hinglish).toContain("consistent hashing"); // tech term preserved
  });

  test("sequence markers", () => {
    const input =
      "First, let's understand the problem. " +
      "Second, let us design the solution. " +
      "Finally, let's wrap up.";

    const { hinglish } = rewrite(input);

    expect(hinglish).toContain("Pehle");
    expect(hinglish).toContain("Dusra");
    expect(hinglish).toContain("Aakhir mein");
  });

  test("Indian analogy substitution", () => {
    const input =
      "Think of it as a coffee shop where every customer is a request. " +
      "For food delivery apps like pizza delivery, latency matters.";

    const { hinglish } = rewrite(input);

    expect(hinglish).toContain("chai ki dukaan");
    expect(hinglish).toContain("Swiggy delivery");
    expect(hinglish).not.toContain("coffee shop");
    expect(hinglish).not.toContain("pizza delivery");
  });

  test("closing and summary", () => {
    const input =
      "To summarize, Redis is an in-memory cache. " +
      "To recap, use it when you need sub-millisecond reads. " +
      "That's it for today!";

    const { hinglish } = rewrite(input);

    expect(hinglish).toContain("Summary yeh hai ki");
    expect(hinglish).toContain("Recap karte hain");
    expect(hinglish).toContain("Bas, itna hi aaj ke liye");
    expect(hinglish).toContain("Redis"); // tech term preserved
  });

  test("Kafka + partition full example", () => {
    const input =
      "In this video, we'll cover how Kafka handles partitioning. " +
      "Think of it as a highway with multiple lanes for messages. " +
      "This is very common in interviews at Google and Amazon.";

    const { hinglish } = rewrite(input);

    expect(hinglish).toMatch(/^Is video mein hum/);
    expect(hinglish).toContain("ise aise samjho");
    expect(hinglish).toContain("expressway");
    expect(hinglish).toContain("Kafka");  // tech term preserved
    expect(hinglish).toContain("Google"); // company name preserved
    expect(hinglish).toContain("Amazon"); // company name preserved
  });
});

// ---------------------------------------------------------------------------
// Tech term preservation — invariants
// ---------------------------------------------------------------------------

describe("tech term preservation", () => {
  const techTerms = [
    "Kafka",
    "Redis",
    "DynamoDB",
    "gRPC",
    "GraphQL",
    "Kubernetes",
    "Docker",
    "PostgreSQL",
    "CAP theorem",
    "ACID",
    "consistent hashing",
    "Zookeeper",
    "Elasticsearch",
    "Terraform",
    "CI/CD",
    "LeetCode",
    "FAANG",
  ];

  test.each(techTerms)("preserves '%s' in output", (term) => {
    const input = `Let me explain how ${term} works in system design.`;
    const { hinglish } = rewrite(input);
    // The term must appear in the output (possibly wrapped in SSML by edge-tts step,
    // but the rewriter itself preserves it as plain text)
    expect(hinglish).toContain(term);
  });

  test("preserves multiple tech terms in same sentence", () => {
    const input =
      "Kafka and Redis together give you low-latency messaging with fast caching.";
    const { hinglish } = rewrite(input);
    expect(hinglish).toContain("Kafka");
    expect(hinglish).toContain("Redis");
  });

  test("preserves code blocks verbatim", () => {
    const input = "The config value `max.poll.records=500` controls batch size.";
    const { hinglish } = rewrite(input);
    expect(hinglish).toContain("`max.poll.records=500`");
    expect(hinglish).toBe(input); // code block sentences pass through untouched
  });
});

// ---------------------------------------------------------------------------
// protectTechTerms (SSML wrapping for edge-tts)
// ---------------------------------------------------------------------------

describe("protectTechTerms()", () => {
  test("wraps Kafka in lang tag", () => {
    const result = protectTechTerms("Kafka mein partition kaise kaam karta hai");
    expect(result).toContain('<lang xml:lang="en-IN">Kafka</lang>');
  });

  test("wraps API Gateway", () => {
    const result = protectTechTerms("API gateway request ko route karta hai");
    expect(result).toContain('<lang xml:lang="en-IN">API</lang>');
  });

  test("does not double-wrap already wrapped terms", () => {
    const alreadyWrapped = 'Ye <lang xml:lang="en-IN">Kafka</lang> hai';
    const result = protectTechTerms(alreadyWrapped);
    // Should not produce nested lang tags
    const matches = result.match(/<lang xml:lang="en-IN">/g);
    expect(matches?.length).toBe(1);
  });

  test("preserves surrounding Hinglish text", () => {
    const result = protectTechTerms("agar Redis cache miss ho jaye");
    expect(result).toContain("agar");
    expect(result).toContain("cache miss ho jaye");
    expect(result).toContain('<lang xml:lang="en-IN">Redis</lang>');
  });
});

// ---------------------------------------------------------------------------
// transformSentence() unit tests
// ---------------------------------------------------------------------------

describe("transformSentence()", () => {
  test("transforms opener: Today we're going to learn", () => {
    const { result } = transformSentence("Today we're going to learn about sharding.");
    expect(result).toMatch(/^Aaj hum samjhenge/);
  });

  test("transforms: Most engineers get this wrong", () => {
    const { result } = transformSentence("Most engineers get this wrong.");
    expect(result).toContain("Zyaadatar developers ye galat samajhte hain");
  });

  test("transforms: Remember,", () => {
    const { result } = transformSentence("Remember, always use indexes.");
    expect(result).toMatch(/^Yaad rakho,\s*always use indexes/);
  });

  test("transforms: Makes sense?", () => {
    const { result } = transformSentence("Makes sense?");
    expect(result).toBe("Samajh aaya?");
  });

  test("returns count > 0 when substitution occurs", () => {
    const { count } = transformSentence("Today we're going to learn about Redis.");
    expect(count).toBeGreaterThan(0);
  });

  test("returns count 0 for already-Hinglish text with no matches", () => {
    const { count } = transformSentence("Aaj hum Redis ke baare mein sikhenge.");
    expect(count).toBe(0);
  });

  test("skips sentences with code blocks when preserveCodeBlocks=true (default)", () => {
    const input = "Set `replication.factor=3` for durability.";
    const { result } = transformSentence(input);
    expect(result).toBe(input);
  });

  test("transforms sentences with code blocks when preserveCodeBlocks=false", () => {
    const input = "Remember, set `replication.factor=3`.";
    const { result } = transformSentence(input, { preserveCodeBlocks: false });
    expect(result).toContain("Yaad rakho,");
  });
});

// ---------------------------------------------------------------------------
// rewriteScenes()
// ---------------------------------------------------------------------------

describe("rewriteScenes()", () => {
  test("rewrites narration fields, preserves other fields", () => {
    const scenes = [
      {
        narration: "Today we're going to learn about Kafka.",
        duration: 5000,
        background: "#000",
        characters: ["teacher"],
      },
      {
        narration: "Remember, partitions enable parallelism.",
        duration: 3000,
      },
    ];

    const result = rewriteScenes(scenes);

    expect(result[0].narration).toMatch(/^Aaj hum samjhenge/);
    expect(result[0].duration).toBe(5000);
    expect(result[0].background).toBe("#000");
    expect(result[0].characters).toEqual(["teacher"]);

    expect(result[1].narration).toMatch(/^Yaad rakho,\s*partitions enable/);
  });

  test("handles empty scenes array", () => {
    expect(rewriteScenes([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getHinglishHook()
// ---------------------------------------------------------------------------

describe("getHinglishHook()", () => {
  test("returns deterministic hook for index 0", () => {
    const hook1 = getHinglishHook("interview", 0);
    const hook2 = getHinglishHook("interview", 0);
    expect(hook1).toBe(hook2);
  });

  test("returns different hooks for different indices", () => {
    const hook0 = getHinglishHook("concept", 0);
    const hook1 = getHinglishHook("concept", 1);
    expect(hook0).not.toBe(hook1);
  });

  test("wraps around on index overflow", () => {
    const hooks = HINGLISH_HOOKS["interview"];
    const hookAtZero = getHinglishHook("interview", 0);
    const hookAtLen = getHinglishHook("interview", hooks.length);
    expect(hookAtZero).toBe(hookAtLen);
  });

  test("interview hooks contain FAANG/interview keywords", () => {
    for (let i = 0; i < HINGLISH_HOOKS.interview.length; i++) {
      const hook = getHinglishHook("interview", i);
      expect(hook.toLowerCase()).toMatch(/interview|faang/);
    }
  });

  test("all hook categories are defined", () => {
    const categories: (keyof typeof HINGLISH_HOOKS)[] = [
      "interview",
      "concept",
      "architecture",
      "general",
    ];
    for (const cat of categories) {
      expect(HINGLISH_HOOKS[cat].length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  test("empty string returns empty string", () => {
    const { hinglish, substitutionCount } = rewrite("");
    expect(hinglish).toBe("");
    expect(substitutionCount).toBe(0);
  });

  test("whitespace-only string", () => {
    const { hinglish } = rewrite("   ");
    expect(hinglish.trim()).toBe("");
  });

  test("paragraph breaks are preserved", () => {
    const input = "Today we learn.\n\nRemember this always.";
    const { hinglish } = rewrite(input);
    expect(hinglish).toContain("\n\n");
  });

  test("multiple consecutive substitutable phrases", () => {
    const input =
      "Remember, makes sense? Don't worry. You've got this!";
    const { hinglish, substitutionCount } = rewrite(input);
    expect(substitutionCount).toBeGreaterThanOrEqual(3);
    expect(hinglish).toContain("Yaad rakho");
    expect(hinglish).toContain("Samajh aaya");
    expect(hinglish).toContain("Ghabraao mat");
    expect(hinglish).toContain("Aap kar sakte ho");
  });

  test("does not transform when transformConnectives=false", () => {
    const input = "And now, let's look at Redis.";
    const { result } = transformSentence(input, { transformConnectives: false });
    expect(result).toContain("And now");
  });

  test("does not substitute analogies when indianAnalogies=false", () => {
    const input = "Think of it as a coffee shop.";
    const { result } = transformSentence(input, { indianAnalogies: false });
    expect(result).not.toContain("chai ki dukaan");
    expect(result).toContain("coffee shop");
  });

  test("substitution is idempotent (second pass doesn't change output)", () => {
    const input = "Today we're going to learn about consistent hashing.";
    const { hinglish: pass1 } = rewrite(input);
    const { hinglish: pass2 } = rewrite(pass1);
    // Second pass on already-Hinglish text should produce identical output
    // (no patterns match already-transformed text)
    expect(pass1).toBe(pass2);
  });
});

// ---------------------------------------------------------------------------
// PHRASE_MAP and CONNECTIVE_MAP sanity checks
// ---------------------------------------------------------------------------

describe("map integrity", () => {
  test("all PHRASE_MAP entries have non-empty replacements", () => {
    for (const [, replacement] of PHRASE_MAP) {
      expect(replacement.length).toBeGreaterThan(0);
    }
  });

  test("all CONNECTIVE_MAP entries have non-empty replacements", () => {
    for (const [, replacement] of CONNECTIVE_MAP) {
      expect(replacement.length).toBeGreaterThan(0);
    }
  });

  test("all ANALOGY_MAP entries have non-empty replacements", () => {
    for (const [, replacement] of ANALOGY_MAP) {
      expect(replacement.length).toBeGreaterThan(0);
    }
  });

  test("PHRASE_MAP patterns are valid RegExp or string", () => {
    for (const [pattern] of PHRASE_MAP) {
      expect(() => new RegExp(pattern)).not.toThrow();
    }
  });
});
