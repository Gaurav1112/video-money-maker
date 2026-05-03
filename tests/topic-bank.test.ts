import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BANK_PATH = resolve(__dirname, '..', 'TOPIC_BANK_100.json');

interface TopicEntry {
  id: number;
  category: string;
  topic: string;
  shortTitle: string;
  longTitle: string;
  hookSpoken: string;
  hookHinglish: string;
  stake: string;
  company: string[];
  salaryBand: string;
  outline: string[];
  primaryCTA: string;
  tags: string[];
  thumbnailText: string;
  estimatedShortViews: number;
  siteTopicSlug: string;
  siteSessionSlug: string;
  shareableMoment: string;
}

const VALID_SITE_TOPIC_SLUGS = new Set<string>([
  'advanced-graphs', 'aws-qa', 'aws', 'company-tech-qa-part3', 'company-tech-qa',
  'core-cs-expanded-1', 'core-cs', 'daily-questions', 'default-flashcards',
  'design-patterns-qa', 'design-patterns', 'ds-algo', 'dsa-advanced', 'dsa-patterns',
  'estimation', 'fenwick-tree', 'greedy-algorithms', 'html-css', 'interview-framework',
  'java-core', 'java-qa-all', 'javascript', 'k8s-docker-qa', 'k8s-docker', 'kafka-qa',
  'kafka', 'nodejs', 'nosql', 'rdbms-sql', 'react-nextjs', 'segment-trees', 'spring-boot',
  'star-questions', 'star-stories', 'string-algorithms', 'system-design-cases-detailed',
  'system-design-cases', 'system-design-fundamentals',
]);

const REQUIRED_FIELDS: (keyof TopicEntry)[] = [
  'id', 'category', 'topic', 'shortTitle', 'longTitle', 'hookSpoken',
  'hookHinglish', 'stake', 'company', 'salaryBand', 'outline', 'primaryCTA',
  'tags', 'thumbnailText', 'estimatedShortViews', 'siteTopicSlug',
  'siteSessionSlug', 'shareableMoment',
];

function loadBank(): TopicEntry[] {
  const raw = readFileSync(BANK_PATH, 'utf-8');
  return JSON.parse(raw) as TopicEntry[];
}

describe('TOPIC_BANK_100.json', () => {
  it('loads without error', () => {
    assert.doesNotThrow(() => loadBank());
  });

  it('has exactly 100 topics', () => {
    const bank = loadBank();
    assert.equal(bank.length, 100);
  });

  it('has no duplicate ids', () => {
    const bank = loadBank();
    const ids = bank.map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length, 'duplicate ids found');
  });

  it('has no duplicate topic names', () => {
    const bank = loadBank();
    const topics = bank.map((e) => e.topic);
    assert.equal(new Set(topics).size, topics.length, 'duplicate topics found');
  });

  it('has all required fields on every entry', () => {
    const bank = loadBank();
    for (const entry of bank) {
      for (const f of REQUIRED_FIELDS) {
        assert.ok(
          entry[f] !== undefined && entry[f] !== null && entry[f] !== '',
          `entry id=${entry.id} missing required field "${String(f)}"`,
        );
      }
    }
  });

  it('every siteTopicSlug is in the valid guru-sishya list', () => {
    const bank = loadBank();
    for (const entry of bank) {
      assert.ok(
        VALID_SITE_TOPIC_SLUGS.has(entry.siteTopicSlug),
        `entry id=${entry.id} has invalid siteTopicSlug "${entry.siteTopicSlug}"`,
      );
    }
  });

  it('has correct category distribution: 40 SD, 20 DSA, 20 behavioral, 10 OS, 10 DB', () => {
    const bank = loadBank();
    const counts = bank.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + 1;
      return acc;
    }, {});
    assert.equal(counts['system-design'], 40, 'system-design count wrong');
    assert.equal(counts['dsa'], 20, 'dsa count wrong');
    assert.equal(counts['behavioral'], 20, 'behavioral count wrong');
    assert.equal(counts['os-networking'], 10, 'os-networking count wrong');
    assert.equal(counts['db-internals'], 10, 'db-internals count wrong');
  });

  it('every outline has exactly 4 items', () => {
    const bank = loadBank();
    for (const entry of bank) {
      assert.ok(Array.isArray(entry.outline), `id=${entry.id} outline not array`);
      assert.equal(entry.outline.length, 4, `id=${entry.id} outline length != 4`);
    }
  });

  it('every company array is non-empty', () => {
    const bank = loadBank();
    for (const entry of bank) {
      assert.ok(Array.isArray(entry.company), `id=${entry.id} company not array`);
      assert.ok(entry.company.length > 0, `id=${entry.id} company is empty`);
    }
  });

  it('estimatedShortViews is between 100 and 10000', () => {
    const bank = loadBank();
    for (const entry of bank) {
      assert.ok(
        typeof entry.estimatedShortViews === 'number',
        `id=${entry.id} estimatedShortViews not number`,
      );
      assert.ok(
        entry.estimatedShortViews >= 100 && entry.estimatedShortViews <= 10000,
        `id=${entry.id} estimatedShortViews out of range: ${entry.estimatedShortViews}`,
      );
    }
  });

  it('hookSpoken differs from hookHinglish on every entry', () => {
    const bank = loadBank();
    for (const entry of bank) {
      assert.notEqual(
        entry.hookSpoken,
        entry.hookHinglish,
        `id=${entry.id} hookSpoken === hookHinglish`,
      );
    }
  });
});
