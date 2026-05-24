---
title: "Is Redis as a Primary Database Genius — or a $1M Mistake Waiting to Happen?"
slug: 002-redis-as-primary-database
publishDate: 2026-05-25
durationSec: 600
---

## Hook

💾 Postgres takes 80ms. Redis takes 0.8ms.

Saw a startup team make the most exciting architecture decision of their year this week — they ripped out Postgres and made Redis their primary database.

Six weeks later, the company lost a day of orders.

## Then-vs-Now

In 2015:
Redis was a cache.
Postgres was the truth.
The split was obvious.

In 2026:
Redis has persistence.
Redis has streams.
Redis has search, JSON, vectors, ACID transactions.
And teams are quietly asking the heretical question — do we even need a "real" database anymore?

It made me think about something many engineering leaders are debating right now: **Is Redis-as-primary actually genius — or just the most expensive way to learn what databases are for?**

## Pros

To be fair, Redis-as-primary solves real problems:

✅ Sub-millisecond reads at scale no SQL engine touches
✅ One system instead of cache + DB + queue
✅ Lower latency for user-facing flows
✅ Massive cost savings on small datasets
✅ Append-only persistence (AOF) is genuinely durable

For session stores, leaderboards, feature flags, real-time counters — Redis-as-primary is brilliant. The data fits the model.

## Cons

But for transactional business data, the reality often looks different:

➡️ Memory is 50× more expensive than disk — your bill scales with your data
➡️ RDB snapshots can lose minutes of writes on crash
➡️ Replication is async — failover can drop committed transactions
➡️ No real foreign keys, no joins, no schema enforcement
➡️ "ACID transactions" only inside a single key — not what your CFO thinks ACID means
➡️ When the data outgrows RAM, your sub-millisecond promise dies overnight

The startup that lost a day of orders? Their primary Redis node OOMed during a flash sale. The replica had stale data. AOF was disabled because someone wanted "faster writes."

The architecture didn't fail. The assumption did.

And customers don't care whether your database is in-memory, on-disk, columnar, or distributed. They only care about ⚡ Their order showing up, 🎯 Their payment being correct, 😊 Their data not disappearing.

## Pivot

The real question is not: "Is Redis fast enough to be a database?"

The real question is: **"Is my data shaped like a Redis problem — or am I forcing it because the benchmarks looked sexy?"**

Because a well-tuned Postgres with a Redis cache can outperform a Redis-only architecture for 90% of business workloads — and survive failures the Redis-only architecture can't even define.

## Lesson

Performance is not the same as correctness. Latency is not the same as durability. A 100× speedup that occasionally loses your data is not a win — it's a deferred liability.

As leaders, the question is sharper than "Redis or Postgres?": 💡 Match the persistence model to the cost of losing one transaction. Some data deserves disk. Some deserves RAM. Mixing them up is how engineering teams turn architecture decisions into board-level incidents.

## Question

Curious to hear from fellow engineering leaders: Have you tried Redis as a primary database — and did it scale with your business, or did the bill (or an outage) eventually push you back to disk?
