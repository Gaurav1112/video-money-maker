# MONETIZATION STACK — guru-sishya.in
## Complete Revenue Architecture, Unit Economics, and Free-Tool Implementation
### Zero-money budget. GitHub Actions automation. India-first.

---

## PRODUCT TIER OVERVIEW

```
FREE  →  ₹0     80-Q FAANG PDF        Lead magnet (email capture)
ENTRY →  ₹150/mo Community Sub        Volume tier (MRR)
MID   →  ₹999   1-on-1 Mock Interview High-margin, limited by time
PREMIUM → ₹4,999 Crash Course         Scalable, async
NATIVE → ₹89/mo YouTube Membership   YT-native (after 500 subs)
```

---

## TIER 1: FREE LEAD MAGNET — 80-Q FAANG Question Bank PDF

### What it is
A structured PDF with 80 real FAANG-asked System Design + DSA questions, organized by company (Google, Amazon, Meta, Flipkart, Paytm), with difficulty tags and GuruSishya video links for each. NOT a random list — a "prep roadmap" framed as "the questions I would give my sishya if they had 30 days."

### Why it works
- Immediate value → low friction to give email
- Every question links to a GuruSishya video → drives views + watch time
- Competitors: Striver's SDE sheet built his entire audience. This is that.

### Free-tool implementation
```
PDF creation:    Canva free tier (export as PDF)
Email capture:   Buttondown.email (free up to 100 subscribers, then $9/mo — 
                 but $9/mo is worth it; treat as $0 for now via free tier)
Automation:      GitHub Actions workflow triggers Buttondown API to tag new
                 subscriber as "pdf-magnet" for segmentation
Landing page:    Carrd.co free tier (single page, form embed)
Delivery:        Buttondown sends PDF attachment on confirmation email
```

### GitHub Actions workflow (zero-cost)
```yaml
# .github/workflows/welcome-email.yml
name: New Subscriber Welcome
on:
  repository_dispatch:
    types: [new-subscriber]
jobs:
  send-welcome:
    runs-on: ubuntu-latest
    steps:
      - name: Tag subscriber
        run: |
          curl -X POST https://api.buttondown.email/v1/subscribers \
            -H "Authorization: Token ${{ secrets.BUTTONDOWN_KEY }}" \
            -d '{"tags":["pdf-magnet","week-1"]}'
```

### Unit economics
- Cost per lead: ₹0 (free tools)
- Target: 50 email subscribers/week from Month 2 onward
- Conversion to ₹150/mo: 5–8% (2.5–4 new community subs per 50 email subscribers)
- Conversion to ₹999 mock: 2–3% (1–1.5 mock bookings per 50 email subscribers)

---

## TIER 2: ₹150/MONTH — "GURU SISHYA COMMUNITY"

### What it is
A living prep community, not just a Discord server. The mental model: "your daily study group run by someone who knows the interview from the inside."

### Deliverables every week (your obligation, hard-committed)
| Day | Deliverable | Time cost |
|-----|-------------|-----------|
| Monday | "Question of the Week" dropped in Telegram (new problem, model answer on Thursday) | 20 min |
| Wednesday | Group mock session — 4 participants, 30-min voice call on Discord/Telegram | 60 min |
| Thursday | Model answer + explanation for Monday's question (video or voice note) | 30 min |
| Friday | "Week Wrap" — 5 top interview tips from that week's content | 20 min |
| Ongoing | Question bank PDF updated monthly (+5 new questions each month) | 60 min/month |

**Total weekly time commitment: ~2.5 hours. Non-negotiable. This is what justifies ₹150.**

### Payment implementation — TWO PATHS

**Path A: Razorpay Subscriptions (Recommended for India)**
- Setup: Free (Razorpay has zero setup fee)
- Transaction fee: 2% + GST on 2% = effectively ~2.36% per charge
- eMandate compliance: ₹150 is under the ₹5,000 RBI threshold, so no additional 2FA required per charge — but you MUST set up eNACH (electronic mandate) for auto-debit. Razorpay handles this. Customer approves once via their bank.
- Recurring: Razorpay Subscriptions API handles auto-debit monthly
- Revenue per subscriber: ₹150 × (1 - 0.0236) = **₹146.46/month**
- Razorpay Subscription Plan creation: Done in Razorpay Dashboard → Products → Subscriptions

```
Net revenue at scale:
100 subs:  ₹14,646/month
200 subs:  ₹29,292/month
555 subs:  ₹81,285/month ← $1,000 target
```

**Path B: Gumroad Membership (Simpler, Higher Fees)**
- Gumroad takes 10% of sales
- Revenue per subscriber: ₹150 × (1 - 0.10) = **₹135/month**
- Works globally; UPI + cards accepted
- Use if Razorpay eMandate setup is too complex in early months

**Recommendation**: Start with Gumroad for speed. Migrate to Razorpay Subscriptions at 50+ subscribers to save the fee difference (~₹750/month saved at 100 subs).

### Community platform: Telegram (Free, India-native)
- Telegram channel + linked Telegram group
- Free Bot API for automation (see GitHub Actions section)
- Why Telegram over Discord: Indian devs are already on Telegram. Striver, Code With Harry, Fraz all have 100K+ Telegram members. Discord has lower India adoption.
- GHA automation: Bot posts Monday question, Thursday answer, Friday wrap automatically

```yaml
# .github/workflows/weekly-community.yml
name: Weekly Community Posts
on:
  schedule:
    - cron: '0 9 * * 1'   # Monday 9 AM IST (3:30 AM UTC)
    - cron: '0 9 * * 4'   # Thursday 9 AM
    - cron: '0 9 * * 5'   # Friday 9 AM
jobs:
  post-question:
    runs-on: ubuntu-latest
    steps:
      - name: Post to Telegram
        run: |
          curl -X POST \
            "https://api.telegram.org/bot${{ secrets.TG_BOT_TOKEN }}/sendMessage" \
            -d "chat_id=${{ secrets.TG_CHANNEL_ID }}" \
            -d "text=$WEEKLY_QUESTION" \
            -d "parse_mode=Markdown"
```

### Anti-churn mechanics (see SUBSCRIPTION_RETENTION.md for full detail)
- 90-day money-back guarantee
- Pause option (no cancel) — member can freeze for 1 month
- Month 2 retention target: 70%

---

## TIER 3: ₹999 — 1-ON-1 MOCK INTERVIEW (30 min)

### What it is
30-minute System Design or DSA mock interview on Google Meet. Recorded. Review notes sent within 24 hours via email. One follow-up Telegram message with 3 personalized practice recommendations.

### This is your highest-ROI activity in months 1–6.
- Your time: 30 min session + 15 min prep + 15 min notes = **60 min total**
- Revenue: ₹999 per session
- Effective hourly rate: **₹999/hour** (~$12/hour) — decent for India
- At 5 sessions/week: ₹4,995/week = ₹19,980/month from this alone
- At 10 sessions/week: ₹39,960/month — approaches your website target alone

### Free-tool implementation

**Booking**: Cal.com (free tier)
- Create "FAANG System Design Mock Interview — 30 min" event
- Availability: block off 5 slots/day, 5 days/week (25 slots/week max)
- Buffer time: 15 min between sessions (auto-configured in Cal.com)
- Timezone: Set to IST (Asia/Kolkata)
- Link: `cal.com/gaurav-gurusishya/mock-interview`

**Payment**: Razorpay Payment Link
- Create one-time ₹999 payment link in Razorpay Dashboard
- Set Cal.com booking to require payment confirmation email before confirming slot
- Manual step: Accept booking → Send payment link → Confirm once paid
- Alternative: Use Cal.com + Razorpay integration (paid Cal.com feature) — skip for now, manual is fine at <20 sessions/week

**Video call**: Google Meet (free, unlimited for 60 min 1-on-1)
- Create a personal Google Meet link
- Cal.com automatically adds it to the booking confirmation email

**Recording**: OBS Studio (free) or Google Meet's built-in record
- Record only with candidate's permission
- Store locally (drive space), do not upload anywhere
- Edit: 5-min highlights clip for Telegram community as social proof (anonymized)

**Review notes**: Standard Google Docs template
- Scores on: Problem decomposition, Component identification, Trade-off articulation, Communication
- 3 personalized video links from your own channel
- Sent via Buttondown triggered email

### Unit economics
```
Gross per session:        ₹999
Razorpay fee (2.36%):    -₹23.58
Net per session:          ₹975.42
Your time cost:           60 minutes

Monthly at 5/week:        ₹19,509
Monthly at 10/week:       ₹39,017
Monthly at 20/week:       ₹78,034 ← physical ceiling without burnout
```

**Burnout ceiling**: 20 sessions/week = 20 hours minimum. At 10 hours/week total work budget, mock interviews alone cannot exceed 8–10 sessions/week without sacrificing content output. Optimize: do mock interview batches (Tuesday + Thursday, 4 sessions/day on those days).

### Scaling: When to raise price
- At 80%+ booking rate (consistently waitlisted): Raise to ₹1,499
- At 90%+ booking rate: Raise to ₹1,999
- Target Month 6+: ₹1,499 × 15 sessions/week = ₹1,12,425/month from mocks alone

---

## TIER 4: ₹4,999 — "FAANG SYSTEM DESIGN CRASH COURSE"

### What it is
A self-paced course with:
- 5–6 hours of recorded video content (use existing pipeline to generate animated explainers, add face-cam intros per module)
- PDF workbook (Canva-designed, 40–60 pages)
- 10 real mock interview question sets with model answers
- Lifetime access + free updates
- Optional: 1 group Q&A live call per cohort (free time investment, high perceived value)

### Positioning
NOT "learn System Design from scratch." Position as: **"The 30-day sprint to passing System Design rounds at Flipkart, Paytm, Amazon India, Google India — built around the questions they actually ask."**

Validate with India context: Cache (Hotstar IPL), Message Queue (Zomato orders), CDN (JioCinema 100M streams), Rate Limiting (PhonePe UPI). This is differentiation. Gaurav Sen uses US examples. You use India examples. Own that.

### Free-tool implementation

**Hosting and delivery**: Gumroad (free, 10% cut)
- Upload video files (Gumroad hosts up to 16GB)
- Attach PDF workbook as downloadable
- Set price: ₹4,999 (Gumroad supports INR)
- "Pay what you want" floor: ₹4,999 (no floor reduction — premium positioning)
- Coupon codes: Early bird at ₹3,499 for presale (set expiry date)

**Alternative if Gumroad fees are too high**: Instamojo (India-native, 2% + ₹3/transaction) — lower fees than Gumroad's 10%. Switch at scale.

**Video hosting**: Gumroad hosts the videos. No YouTube (don't want indexed content for free). No Vimeo (paid). Gumroad is sufficient for <100 students.

**Updates delivery**: When you update the course, Gumroad automatically notifies existing buyers. No extra work.

### Unit economics
```
Price:                    ₹4,999
Gumroad fee (10%):       -₹499.90
Net per sale:             ₹4,499.10

Monthly revenue:
5 sales:   ₹22,495
10 sales:  ₹44,991
20 sales:  ₹89,982 ← equivalent to 599 community subscribers
```

**The course multiplier**: One 10-hour recording effort (done once) generates revenue indefinitely. A mock interview requires 1 hour per sale. The course has **infinite leverage** — it's the most important product to build, even if it takes longer to launch.

### Launch sequence
1. Month 3–4: Presale announcement via email list. ₹3,499 early bird. Target 10 buyers.
2. Month 5: Full course recorded and delivered to presale buyers.
3. Month 5+: Full price ₹4,999 live. Email list announcement. LinkedIn post. Short about the launch.
4. Month 6+: One 2-minute "what you'll learn" Short on YouTube → Gumroad link in bio.

---

## TIER 5: YOUTUBE ADSENSE

### Reality check
This is supplemental income, not primary. Here is the real India RPM data for your niche:

| Content Type | India RPM (₹) | India RPM ($) | When achievable |
|--------------|--------------|---------------|-----------------|
| System Design (English) | ₹67–₹150 | $0.80–$1.80 | After YPP (1K subs, 4K hrs) |
| DSA/Interview prep | ₹50–₹125 | $0.60–$1.50 | Same |
| Hindi/Hinglish dev content | ₹42–₹100 | $0.50–$1.20 | Same |

**YPP eligibility**: 1,000 subscribers + 4,000 watch hours (long-form) OR 10M Shorts views in 90 days.
- Your path: Long-form watch hours (Shorts don't count toward 4,000 hours). Each long-form video at 8 minutes average = 8 minutes per view. Need 30,000 views on long-form to hit 4,000 watch hours. This requires real SEO traction.
- Realistic Month 6 AdSense: ₹2,000–₹8,000/month (based on 20K–80K monthly long-form views)
- Realistic Month 12 AdSense: ₹8,000–₹25,000/month (based on 100K–300K monthly views)

**What to do**: Enable it when you qualify. Don't optimize for it. AdSense is the gravy, not the steak.

---

## TIER 6: YOUTUBE CHANNEL MEMBERSHIPS (₹89/MONTH)

### When available
500 subscribers + 3,000 watch hours + YPP accepted. Possibly Month 4–6.

### What to offer (different from ₹150/mo community)
- ₹89/month (YouTube native, YT takes 30%)
- Net to you: ₹62.30/month per member
- Perks: Members-only YouTube posts, early video access, custom emoji
- This is DIFFERENT from the ₹150/mo Telegram community — position clearly
- YouTube membership = YouTube-native perks only
- ₹150/mo = comprehensive Telegram community + mocks + Q&A

**Target**: 200 YouTube members by Month 12 = ₹12,460 net/month

---

## TIER 7: AFFILIATE INCOME

### Programs to join (all free, all relevant to India audience)

| Partner | Product | Commission | Avg order | Your cut |
|---------|---------|------------|-----------|---------|
| Educative.io | System Design courses | 20% | $20–59 | $4–$12/sale |
| Scaler Academy | Placement bootcamp | ₹5,000–₹15,000 | ₹2–5L | Negotiated |
| LeetCode Premium | Interview prep | 15% | $35/year | $5.25/sale |
| Hostinger | Web hosting | 60% first order | $20 | $12/sale |
| Razorpay for Creators | Payment platform | ₹500–₹1,000/referral | — | ₹500–₹1K |

**How to use**: Every video description has a "Resources Used" section with affiliate links. Every email has a P.S. with one affiliate link. Never more than 2 affiliate links per touchpoint.

**Target Month 6 affiliate**: ₹3,000–₹10,000/month (15–50 affiliate conversions)

---

## TIER 8: SPONSORSHIPS

### Reality check: When this becomes available
- Minimum: 3,000–5,000 subscribers, consistent 10K+ monthly views
- Typical rate at 5K India dev subs: ₹15,000–₹30,000 per integration
- First sponsorship target: Month 7–9

### Who to pitch (cold email, no middleman needed)
1. **Hostinger India** — actively sponsors Indian tech YouTubers at 5K+ subs
2. **Coding Ninjas** — pays ₹10K–₹25K per video to mid-tier creators
3. **Internshala** — sponsors interview prep content specifically
4. **Unstop** (formerly Dare2Compete) — coding challenge platform
5. **LeetCode** — direct sponsorship program

### How to pitch at 3K subscribers
Email subject: "Partnership proposal — @GuruSishya-India (3K subs, 70%+ FAANG-prep audience)"
Body: "Our audience is actively preparing for FAANG interviews at Flipkart, Amazon, Google India. Your product [X] solves [Y] for exactly this audience. I am proposing an [integrated mention / dedicated video / 30-second ad read] at ₹15,000 for first collaboration."

---

## PAYMENT COMPLIANCE — INDIA RBI RULES

### Critical: Auto-debit regulations post October 2021

The RBI eMandate framework requires:
1. For recurring payments > ₹5,000: Additional Factor Authentication (AFA) on EVERY charge (not just first)
2. For recurring payments ≤ ₹5,000: AFA only on first transaction (mandate registration), then auto-debit proceeds

**Your ₹150/month subscription is under ₹5,000 — the more favorable tier.**

**Process with Razorpay Subscriptions**:
1. Customer subscribes → Razorpay shows mandate registration form
2. Customer authenticates once (OTP + bank approval)
3. Subsequent ₹150 charges deduct automatically, no customer action required
4. Razorpay handles all RBI compliance, pre-debit notifications (mandatory 24 hours before charge)

**Razorpay mandatory notification**: Razorpay auto-sends pre-debit SMS/email 24 hours before each charge. You don't need to implement this — it's built in. Non-compliance with this rule can result in payment gateway suspension.

**For UPI AutoPay**: Razorpay supports UPI AutoPay (₹150 is well within NPCI's ₹15,000 daily limit for recurring UPI). This is increasingly the preferred method for Indian users over card-based auto-debit.

### GST compliance
- If your annual revenue exceeds ₹20 lakhs: GST registration mandatory
- On digital services (subscriptions, courses): 18% GST applicable
- At early stage (<₹20L/year): Not mandatory, but keep records
- Razorpay and Gumroad do NOT collect GST on your behalf — that is your responsibility

---

## TOOL STACK SUMMARY

| Need | Tool | Cost | Automation |
|------|------|------|-----------|
| Email capture | Buttondown | Free (100 subs), $9/mo after | GHA workflow |
| Email broadcasts | Buttondown | Same | GHA cron |
| Community payments | Razorpay Subscriptions | 2.36% per charge | Webhook → GHA |
| Course delivery | Gumroad | 10% per sale | Automatic |
| Mock booking | Cal.com | Free | Email auto-confirm |
| Mock payment | Razorpay Payment Link | 2.36% | Manual check |
| Community platform | Telegram (bot) | Free | GHA → Bot API |
| Video calls | Google Meet | Free | Cal.com link |
| Landing page | Carrd.co | Free | — |
| Analytics | GoatCounter | Free, self-host | GHA deploy |
| PDF creation | Canva | Free | Manual |
