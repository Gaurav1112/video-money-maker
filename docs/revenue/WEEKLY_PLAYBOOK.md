# WEEKLY PLAYBOOK — 12 Weeks of Execution
## ≤10 hours/week of human work. Automation handles the rest.

---

## TIME BUDGET BREAKDOWN (Every Week)

```
Total human work budget: 10 hours/week

Mock interviews (highest ₹/hour):  3.5 hrs  (35%)
Community management:              2.0 hrs  (20%)
Content recording (face-cam only): 1.5 hrs  (15%)
Outreach (cold DMs, LinkedIn):     1.0 hr   (10%)
Email / funnel work:               0.5 hr   (5%)
Weekly KPI review:                 0.5 hr   (5%)
Social (replies, Reddit):          1.0 hr   (10%)

TOTAL:                            10.0 hrs
```

**What GHA automation handles (NOT in your 10 hours):**
- Video rendering and YouTube upload (fully automated)
- Short creation and upload (fully automated)
- Weekly Telegram community posts (GHA cron)
- Welcome email sequence for new subscribers (Buttondown automation)
- Payment failure retries and notifications (Razorpay + GHA webhook)
- Pre-debit notifications (Razorpay mandates)
- KPI log updates (GHA weekly pull)

---

## WEEK 1: INFRASTRUCTURE WEEK
**Theme: Build the money-making plumbing before the first rupee can flow**

### Monday (2 hours)
- [ ] Create Buttondown account → set up welcome email sequence (3 emails: Day 0, Day 3, Day 7)
- [ ] Upload 80-Q FAANG PDF to Buttondown as attachment
- [ ] Set up subscriber tag: "pdf-magnet"

### Tuesday (2 hours)
- [ ] Create Razorpay account → complete full KYC (PAN, bank, address)
- [ ] Create Razorpay Subscription Plan: Name="GuruSishya Community", Amount=₹150, Interval=Monthly
- [ ] Create Razorpay Payment Link: Name="1-on-1 Mock Interview", Amount=₹999

### Wednesday (2 hours)
- [ ] Create Cal.com account → create event "FAANG System Design Mock Interview — 30 min"
  - Set availability: 10 AM–8 PM IST, Tuesday + Thursday
  - Add Google Meet link to confirmation email
  - Block 15-minute buffers between sessions
- [ ] Create Telegram channel: "GuruSishya — FAANG Prep Daily"
- [ ] Create Telegram group linked to channel: "GuruSishya Community"

### Thursday (2 hours)
- [ ] Create Gumroad account → list the ₹4,999 crash course as a product (even as "coming soon" with presale price ₹3,499)
- [ ] Create Carrd.co landing page with: headline, PDF capture form (Buttondown embed), mock interview booking link, community subscription link
- [ ] Update YouTube channel description + all existing video descriptions with: PDF link, Cal.com link, Telegram link

### Friday (1 hour)
- [ ] Update YouTube About page with real photo and bio: "Hi, I'm Gaurav — [your background]. Built this to make FAANG prep accessible to every Indian engineer, not just IIT grads."
- [ ] Pin PDF link in YouTube community post
- [ ] Post on LinkedIn: "I'm doing 10 free FAANG System Design mock interviews this month to test my curriculum. DM me to book a slot." (This is Week 1 cold outreach — don't charge yet)

**Automation setup (2 hours, can be done in parallel):**
- [ ] Create `.github/workflows/weekly-community.yml` (Telegram Monday/Thursday/Friday posts)
- [ ] Create `.github/workflows/weekly-kpi-pull.yml` (Razorpay + Buttondown API pull to CSV)

---

## WEEK 2: FIRST CONTENT PUSH + FIRST OUTREACH
**Theme: Distribution beats creation. Get existing videos seen.**

### Monday (1.5 hours — recording)
- [ ] Record one face-cam intro video (30 seconds): "Hi, I'm Gaurav. This channel is for every Indian engineer who wants to crack FAANG interviews without spending ₹50,000 on bootcamps. Here's exactly what we cover:" — link to best existing Long video in description
- [ ] Upload this as a new YouTube Short titled "Why I built GuruSishya 🎯 #systemdesign #faang #india"

### Tuesday (1.5 hours — mock interviews)
- [ ] Respond to any LinkedIn DMs from Week 1 free mock offer
- [ ] Do 2 free mock interviews (45 min each) — these are your portfolio. Record learnings.
- [ ] After each free mock: "Would you be willing to give ₹999 for your next session? I'm formally launching paid sessions next week."

### Wednesday (1 hour — community)
- [ ] Run first Telegram group mock session (informal, just announce in channel + collect 3–4 people who want to participate)
- [ ] Post in group: "Hi everyone 👋 I'm Gaurav. What's your target company and what area of System Design feels weakest? Reply and I'll pick Wednesday's discussion topic based on your answers."

### Thursday (1 hour — outreach)
- [ ] Post on r/developersIndia: "I built a free 80-question FAANG System Design practice sheet — anyone preparing for SDE interviews can get it here [link]. Happy to review your answers too."
- [ ] Post on r/cscareerquestions: Same post (slightly reworded for global audience)
- [ ] Cold DM 10 LinkedIn profiles: Engineers with "SDE" or "Software Engineer" title who have posted about interview prep in last 30 days. Message: "Hey [name], saw you're prepping for interviews — I do free FAANG System Design mocks. Interested? No pitch, just practice."

### Friday (0.5 hours — KPI review)
- [ ] Check: How many email sign-ups from Reddit post?
- [ ] Check: Any Cal.com inquiries?
- [ ] Note: What questions are people asking in Telegram?

### Saturday/Sunday: AUTOMATION ONLY
GHA pipeline should publish 2 Shorts automatically from the queue.

---

## WEEK 3: TRANSITION TO PAID
**Theme: First ₹999 transactions**

### Monday (1.5 hours — content)
- [ ] Record short face-cam intro (45 sec) for ONE existing Long video: "In this video, I explain [topic] with the India-specific [Zomato/Hotstar] example. Most tutorials use American examples — we don't."
- [ ] Re-upload or add this as an unlisted intro card on the best Long video

### Tuesday + Thursday (3.5 hours — mock interviews)
- [ ] Do 3 paid mock interviews (₹999 each = ₹2,997). Sessions blocked 10 AM, 12 PM, 2 PM IST.
- [ ] After each session: Send review notes (Google Docs template) within 24 hours
- [ ] Buttondown: Create a "post-mock" automated email with 3 curated video recommendations

### Wednesday (1 hour — community)
- [ ] Run weekly Wednesday mock session in Telegram voice chat
- [ ] Announce to Telegram group: "Community subscription launching next week — ₹150/month, founding member price locked for life for the first 50 people. DM me to get on the waitlist."

### Thursday (1 hour — outreach)
- [ ] Send 15 cold LinkedIn DMs (same template as Week 2)
- [ ] Post 1 LinkedIn article: "The 3 System Design mistakes I see in every Indian FAANG interview" — link to your best video at the bottom

### Friday (0.5 hours — KPI review)
- [ ] Target check: 3+ mock interviews booked? Email list at 30+ subscribers? If not, what broke?

---

## WEEK 4: COMMUNITY LAUNCH
**Theme: First ₹150/month subscribers**

### Monday (0.5 hours)
- [ ] Email blast to entire Buttondown list: Subject: "Founding Member slots open (only 100 available)" — announce ₹150/month community with the Razorpay subscription link

### Tuesday + Thursday (3.5 hours — mocks)
- [ ] 3–5 mock interviews. Target: 4 this week.
- [ ] Ask every satisfied client: "Would you share a 2-sentence testimonial for the website?" Collect via email reply.

### Wednesday (1 hour — community)
- [ ] Run the Wednesday mock session
- [ ] Welcome the first paying community members personally in Telegram

### Thursday (1 hour — outreach + LinkedIn)
- [ ] 20 cold DMs on LinkedIn
- [ ] Post on LinkedIn: "I opened a ₹150/month FAANG prep community. Week 1: [number] people joined. Here's what we're covering this month:" — build in public

### Friday (0.5 hours — KPI)
- [ ] Community subs count? Email list growth this week? Mock bookings pipeline?

---

## WEEKS 5–8: SCALE THE ENGINE
**Theme: Compound everything that's working. Kill what isn't.**

### Standard weekly rhythm (every week, Weeks 5–8):

**Monday (1.5 hours)**
- [ ] Record 1 face-cam intro (30–45 sec) for a new video in the pipeline queue
- [ ] Review GHA automation output — any pipeline errors? Any failed uploads?
- [ ] Reply to 20 YouTube/Telegram comments (best ROI for community trust)

**Tuesday + Thursday (3.5 hours)**
- [ ] 4–5 mock interviews per week (₹3,996–₹4,995/week)
- [ ] Post-session: Send review notes within 24 hours (non-negotiable — this is product quality)

**Wednesday (1 hour)**
- [ ] Wednesday group mock session (voice chat, Telegram)
- [ ] GHA auto-posted Monday question → you post model answer today (30 min prep, 15 min post)

**Thursday (1 hour)**
- [ ] 15–20 cold LinkedIn DMs (consistent, every week — this fills the mock booking pipeline)
- [ ] 1 LinkedIn post (build-in-public or insight post linking to your best video this week)

**Friday (0.5 hours)**
- [ ] Weekly KPI review (see KPI_DASHBOARD.md template)
- [ ] Email list: Any new subscribers to personally welcome?

**Ongoing automation (no human time):**
- GHA publishes 3 Shorts + 1 long-form per week
- GHA posts Monday question, Thursday answer, Friday wrap in Telegram
- Buttondown sends Day 0/3/7 welcome sequence to new subscribers
- Razorpay handles monthly charges, retries, pre-debit notifications

### Week 5 specific action: First course presale
- [ ] Email blast: "I'm building a FAANG System Design Crash Course. First 10 people get it at ₹3,499 (vs. ₹4,999 after launch). [Link to Gumroad presale]"
- [ ] Target: 5 presale buyers. If you get 5, build the course. If you get 0, the email list is too small — keep growing before trying again.

### Week 7 specific action: Reddit AMA
- [ ] Post on r/developersIndia: "I've done [X] FAANG System Design mock interviews in the last 6 weeks. AMA about what I've seen." — This drives traffic and email sign-ups. Answer every comment.
- [ ] Pin your PDF link in the AMA post.

---

## WEEKS 9–12: MONETIZATION MATURITY
**Theme: Prepare the course. Validate sponsorship potential. Compound MRR.**

### Week 9: Course recording begins (if presale validated)
- [ ] Record Module 1 of crash course (60 min of content). Face-cam intro (3 min) + existing pipeline animations.
- [ ] Deliver to presale buyers as "early access." Their feedback improves Module 2–5.
- [ ] Email: "Course early access is live. Here's Module 1. Your feedback shapes the rest."

### Week 10: Community milestone push
- [ ] If community is at 50+ subs: Send "50 engineer milestone" email — share what the community has achieved, tease what's coming at 100.
- [ ] Post short: "Our community just hit 50 engineers prepping together. Here's what's working." — social proof + CTA to join.

### Week 11: Sponsorship outreach (if 2,000+ subs)
- [ ] Research: Hostinger India, Coding Ninjas, Internshala content partnership teams on LinkedIn.
- [ ] Send 3 cold sponsorship pitch emails (see MONETIZATION_STACK.md sponsorship section for template).
- [ ] Even if 0 replies, the pipeline is seeded for Month 4–5 when you hit 5K subs.

### Week 12: Plan review + Month 4 recalibration
- [ ] Block 2 hours for a full 12-week retrospective:
  - What revenue stream performed best (₹/hour of your time)?
  - What's the email list conversion rate to community?
  - Is mock interview demand limited by slots or by demand?
  - Did the course presale validate?
- [ ] Decision point: Double down on the top 2 revenue streams. Reduce time on bottom performers.
- [ ] If MRR is below ₹20,000 at Week 12: Revisit RISKS.md and consider bridge income.

---

## DAILY MICRO-HABITS (5–10 MINUTES, EVERY DAY)

These don't count toward the 10 hours because they're habits, not tasks:
- Reply to 3 Telegram messages or YouTube comments
- Check Cal.com for new bookings
- Check if GHA pipeline ran successfully (no failed actions)
- One-sentence reply to any new email subscriber

---

## THE 10-HOUR HARD STOP RULE

When you hit 10 hours for the week, stop. No exceptions.

Here's why: The automation is doing the equivalent of 30 additional hours of work per week (video rendering, publishing, email sequences, community posts, KPI tracking). Your 10 hours are for the irreplaceable human elements: relationship, judgment, and mock interview delivery. Overworking those hours leads to quality degradation and burnout — which kills the plan faster than any algorithm change.

If the workload consistently exceeds 10 hours, it means either: (a) mock demand is exceeding your capacity (raise prices), or (b) community management is out of control (use more Telegram bot automation for FAQs).

---

## CONTENT OUTPUT SCHEDULE (GHA AUTOMATED)

| Day | Human action required | Automation action |
|-----|----------------------|-------------------|
| Monday | Record face-cam intro (30 min) | GHA publishes 1 Short at 8 AM IST |
| Tuesday | Mock interviews | GHA publishes 1 Long-form at 10 AM IST |
| Wednesday | Community mock session (1 hr) | Telegram bot posts Wednesday mock reminder |
| Thursday | Mock interviews, 15 LinkedIn DMs | GHA publishes 1 Short at 8 PM IST |
| Friday | KPI review (30 min) | Telegram bot posts Friday wrap, Buttondown weekly digest sent |
| Saturday | Nothing | GHA publishes 1 Short at 11 AM IST |
| Sunday | Nothing | GHA pulls weekly KPI to CSV, Razorpay report generated |
