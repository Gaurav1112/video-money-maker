# SUBSCRIPTION RETENTION — ₹150/Month Community
## Churn is the silent killer of MRR. Every 1% monthly churn you prevent = ₹1,500+ saved at 100 subs.

---

## THE MATH OF CHURN AT ₹150/MONTH

At ₹150/month, your revenue is brutally sensitive to churn. Here's why this document exists:

```
Scenario: You acquire 20 new subscribers per month
With 30% monthly churn (terrible):
  Month 1:  20 subs
  Month 2:  20 + 20 - 6  = 34 subs
  Month 3:  34 + 20 - 10 = 44 subs  ← flatlines here
  Month 6:  ~47 subs (plateau)
  Revenue:  ₹7,050/month forever. Never escapes.

With 10% monthly churn (good):
  Month 6:  ~95 subs
  Revenue:  ₹14,250/month (2× better)

With 5% monthly churn (excellent):
  Month 6:  ~134 subs
  Revenue:  ₹20,100/month (3× better)
```

**The target**: Month 2 retention ≥ 70% (i.e., 30% churn — bare minimum). Month 6 retention ≥ 85% (15% annual churn). Month 12 retention ≥ 90%.

A subscriber who stays 12 months is worth ₹1,800. A subscriber who leaves after 2 months is worth ₹300. **Retention 6× multiplies lifetime value.**

---

## WHY PEOPLE CHURN AT ₹150/MONTH (INDIA-SPECIFIC)

Understand the Indian buyer psychology first:
1. **Guilt purchase churn**: Subscribed on impulse after an exciting video. Forgot about it. Churns when they see the ₹150 debit.
2. **Exam cycle churn**: Interview prep is seasonal. Student finishes interview season → churns.
3. **Value not-received churn**: Subscribed but never engaged with community. Felt like the content wasn't for them.
4. **Better-alternative churn**: Found Striver's free sheet or a cheaper option.
5. **Financial pressure churn**: India-specific — monthly budget pressure is real. ₹150 gets cut before Netflix.

---

## ANTI-CHURN TACTIC SYSTEM

### TACTIC 1: "Bring Your Toughest Interview Q" — Weekly Mock Session

**The mechanic**: Every Wednesday, 30-minute group voice session in Telegram. Any community member can submit a question Monday via form. You pick the most interesting one. 4 people join live to analyze it. Recording shared to community.

**Why this kills churn**: Active participants almost never churn. The session is the reason they stay. If they miss 3 sessions in a row, they feel disconnected — trigger an automated re-engagement ping.

**Implementation**:
```
Monday:  GHA bot posts in Telegram: "Submit your toughest System Design Q for Wednesday!"
         Buttondown form link → Google Sheet collects entries (free)
Tuesday: You pick the best question. GHA bot posts "This Wednesday: [Question]. Join at 8 PM IST."
Wednesday 8 PM: 30-min Telegram voice chat (free, native feature)
Thursday: GHA bot posts recording link (Telegram auto-saves voice chats)
```

**Time cost**: 45 minutes/week. The most important 45 minutes you spend.

### TACTIC 2: Monthly Cohort Challenge

**The mechanic**: First week of each month, launch a "30-Day LeetCode/System Design Sprint" inside the community. 5 questions over 30 days. Leaderboard on Telegram (manual pin or bot).

**Why this kills churn**: Progress creates identity. Someone who's on day 15 of a sprint does NOT cancel their ₹150 subscription. The sunk-cost psychology works FOR you here.

**Implementation**:
- Announce sprint on Day 1 via Telegram broadcast (GHA cron post)
- Day 1, 7, 14, 21, 30: GHA bot posts the next problem with links to relevant videos
- End of sprint: GHA bot posts leaderboard (manually compiled in first 3 months, then automate with a Telegram bot tracking reactions)
- Top 3 completers: Featured in next video description as "Community Champions"

**Time cost**: 2 hours setup/month + 30 min/day checking sprint participation.

### TACTIC 3: Alumni Network — "FAANG Hire" Social Proof Feed

**The mechanic**: When a community member gets a FAANG/Tier-1 offer, create a mini "placement story" — their question, their prep duration, their outcome. Post in Telegram channel and as a YouTube Short.

**Why this kills churn**: Nothing retains members better than proof that the product works. "Rohan from our community just got an Amazon offer" posts drive sign-ups AND retention simultaneously.

**Implementation**:
- Month 1: Email all existing community members asking for their interview journey
- Create a standard template: 5 questions, 200-word format
- GHA automation: Every "placement story" email triggers a Telegram post + queues a Short creation in your pipeline

**Critical**: Ask before publishing. Get explicit consent. Blur company-specific details if requested.

### TACTIC 4: 90-Day Money-Back Guarantee

**The mechanic**: "If you're not satisfied in 90 days, full refund. No questions." This is radical but it works.

**Why this kills churn**: Counter-intuitively, the security of knowing they can leave REDUCES cancellations. Buyers with high confidence in the product's legitimacy churn less. The psychological safety net keeps them engaged.

**India-specific math**: At ₹150/month, the worst-case scenario is refunding 10% of subscribers at Month 3 = 10% × ₹450 (3 months × ₹150) = ₹45 per refund. The retained subscribers from the trust signal are worth far more.

**Implementation**: Add "90-Day Money-Back" to Gumroad/Razorpay product description. Create a simple refund form (Google Form). Process refunds within 24 hours. No friction — a frictionless refund builds MORE trust than fighting it.

### TACTIC 5: Pause-Not-Cancel (India's Most Important Feature)

**The mechanic**: Before anyone cancels, give them a "pause for 1 month" option. This is especially important for Indian subscribers who have seasonal budget pressure.

**Why this kills churn**: Studies show 25–40% of "cancel" intent converts to "pause" when offered. Paused subscribers have 70% return rate. A pause costs you ₹150 × 1 month. A cancel costs you the subscriber.

**Implementation with Razorpay Subscriptions**:
- Razorpay has a pause subscription API endpoint
- Create a "Manage Subscription" page on guru-sishya.in with Pause and Cancel buttons
- Pause flow: User clicks Pause → GHA webhook → Razorpay API suspends next charge → User gets confirmation
- Resume flow: GHA cron checks for paused subs → after 30 days → sends "Welcome back" email → Razorpay resumes

```yaml
# .github/workflows/pause-subscription.yml
name: Handle Subscription Pause
on:
  repository_dispatch:
    types: [subscription-pause-request]
jobs:
  pause:
    runs-on: ubuntu-latest
    steps:
      - name: Pause via Razorpay API
        run: |
          curl -X POST \
            "https://api.razorpay.com/v1/subscriptions/${{ github.event.client_payload.sub_id }}/pause" \
            -u "${{ secrets.RAZORPAY_KEY }}:${{ secrets.RAZORPAY_SECRET }}"
      - name: Send pause confirmation
        run: |
          # Buttondown API call to send pause confirmation email
          curl -X POST https://api.buttondown.email/v1/emails \
            -H "Authorization: Token ${{ secrets.BUTTONDOWN_KEY }}" \
            -d '{"subject":"Subscription paused for 30 days","body":"..."}'
```

### TACTIC 6: Churn-Trigger Detection and Intervention

**The mechanic**: Proactively identify at-risk subscribers before they cancel. Three warning signals:
1. Not joined a group mock session in 3+ weeks
2. Not opened last 3 community emails (tracked via Buttondown opens)
3. Asked a billing question (any message containing "cancel" or "refund")

**For each at-risk signal, fire an automated outreach**:

Signal 1 (inactive in mocks): Telegram DM from the GuruSishya bot: "Hey [name], missed you in the last few Wednesday sessions! The community has been discussing [recent topic]. Here's a quick recap: [link]. Wednesday's session has space for one more — want to join?"

Signal 2 (email disengagement): Buttondown automation: Send a re-engagement email with the subject: "Did we let you down? Be honest." — Offer a free 1-on-1 feedback call.

Signal 3 (billing question): Personal reply within 2 hours. Offer the pause option first. Refund only if pause declined.

**Implementation**:
- Buttondown has built-in engagement tagging — tag subscribers based on open rates automatically
- GHA workflow queries Buttondown API weekly for "inactive" tags → triggers personalized outreach

### TACTIC 7: Founding Member Lock-In

**The mechanic**: The first 100 subscribers get "Founding Member" status — locked at ₹150/month for life, even when you raise prices. They also get a Founding Member badge in Telegram.

**Why this kills churn**: Status is a powerful retention tool. No one cancels a founding membership. Price anchoring means they compare ₹150 to the future ₹299 price, not to free alternatives.

**Implementation**:
- Razorpay Subscription: Create a separate "founding-member" plan at ₹150 that never raises
- Cap at 100 seats: "Only 100 Founding Member slots available — thereafter ₹299/month"
- Telegram: Give founding members a ⭐ emoji tag in their display name

---

## ONBOARDING SEQUENCE (CRITICAL — First 7 Days Determine 90% of Churn)

Poor onboarding is the #1 cause of first-month churn. A subscriber who doesn't understand what they bought, or who feels overwhelming uncertainty, leaves within 30 days.

### Day 0: Welcome (Immediate, automated)
**Buttondown trigger email** on payment confirmation:
```
Subject: Welcome to GuruSishya Community — Your First Steps 🎯

Hi [name],

You're in. Here's exactly what happens now:

1. Join the Telegram: [link] — This is your home base
2. Introduce yourself (just 2 sentences): "I'm [name], preparing for [company], my weakest area is [X]"
3. Wednesday at 8 PM IST: First group mock session. Be there.

Your 80-Q question bank is attached.

— Gaurav
```

### Day 1: Quick Win
GHA automated Telegram DM: "Hey [name], I saw you joined. What's your #1 System Design weak spot? Reply here and I'll point you to the exact video/session for it."

### Day 3: Engagement Nudge
GHA automated email: "Community tip: The Wednesday mock session is the most valuable thing in your membership. Here's how to get the most out of it: [3-bullet guide]"

### Day 7: First Value Check-In
Manual (you, personally): Check if the new subscriber has posted in Telegram. If not, send a personal Telegram message: "Hi [name], wanted to check in — have you had a chance to explore the community? What's your timeline for interviews?"

**This one manual message has the highest ROI of anything you do in week 1.**

---

## CHURN TRACKING DASHBOARD (Weekly)

Track in a simple Google Sheet (free) or GitHub repo markdown:

| Week | New Subs | Churned | Net | Churn Rate | MRR |
|------|----------|---------|-----|------------|-----|
| W1   | —        | —       | —   | —          | —   |

**Red alert thresholds**:
- Weekly churn >5% of subscriber base: Immediate community audit
- Onboarding email open rate <50%: Rewrite subject lines
- Mock session attendance <30% of community: Time/format change needed
- More pauses than new subs in a week: Investigate trigger
