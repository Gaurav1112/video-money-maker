# KPI DASHBOARD — @GuruSishya-India + guru-sishya.in
## Weekly Metrics, Free Tools, and Red-Light Thresholds

---

## THE NORTH STAR METRIC

**Monthly Recurring Revenue (MRR)** — the single number that determines whether the plan is working.

Everything else (views, subscribers, email opens) is a leading indicator. MRR is the lagging truth. Check it weekly. Never rationalize a declining MRR with growing views.

---

## TOOL STACK FOR TRACKING (100% FREE)

| What to track | Free Tool | Where to check | Automation |
|---------------|-----------|----------------|-----------|
| YouTube views, CTR, AVD, ATR | YouTube Studio | studio.youtube.com | Pull weekly manually |
| Website analytics | GoatCounter (self-hosted on GH Pages) | your-goatcounter.io | GHA deploy |
| Email list size + opens | Buttondown dashboard | buttondown.email/analytics | API polling via GHA |
| MRR, subscriber count | Razorpay Dashboard | dashboard.razorpay.com | Webhook to Google Sheet |
| Course sales | Gumroad analytics | app.gumroad.com/dashboard | Manual weekly |
| Mock bookings | Cal.com dashboard | app.cal.com/bookings | Manual weekly |
| Telegram community | Telegram admin panel | t.me/[channel]/admin | Manual |

**The weekly KPI ritual**: Every Sunday, 20 minutes. Pull all numbers. Update the tracking sheet. Flag any red-light. Adjust the playbook for the week ahead.

---

## METRIC CATEGORIES

### A. REVENUE METRICS (Weekly)

#### 1. Monthly Recurring Revenue (MRR)
- **Definition**: (Active ₹150/mo subs) × ₹150 + any active annual contracts
- **Track via**: Razorpay Dashboard → Subscriptions → Active count
- **Update frequency**: Weekly (check every Monday)
- **Formula**: `MRR = active_subs × 150`
- 🟢 **Green**: Week-over-week MRR +5% or more
- 🟡 **Yellow**: Week-over-week MRR flat or +1–4%
- 🔴 **Red**: Week-over-week MRR negative (net churn)

#### 2. New MRR Added (Weekly)
- **Definition**: New subscribers × ₹150 this week
- 🟢 Green: ≥5 new community subs/week (Month 1–3), ≥15/week (Month 4+)
- 🟡 Yellow: 2–4/week
- 🔴 Red: 0–1/week for 2 consecutive weeks

#### 3. MRR Churn (Weekly)
- **Definition**: Cancelled subscribers × ₹150 this week
- 🟢 Green: Weekly churn <2% of total MRR
- 🟡 Yellow: 2–4% weekly churn
- 🔴 Red: >4% weekly churn = immediate community audit

#### 4. Mock Interview Revenue (Weekly)
- **Definition**: Number of ₹999 sessions completed × ₹975 (net of Razorpay fee)
- **Track via**: Cal.com bookings completed + Razorpay payment confirms
- 🟢 Green: ≥5 sessions/week by Month 3
- 🟡 Yellow: 2–4 sessions/week
- 🔴 Red: 0–1 session/week in Month 3+ = cold outreach strategy broken

#### 5. Course Revenue (Per Launch)
- **Track via**: Gumroad dashboard
- 🟢 Green: ≥10 presale buyers before launch
- 🔴 Red: <3 presale buyers = course has no validated demand, do not invest in recording

#### 6. Total Weekly Revenue
- Sum of all above
- Target progression: See REVENUE_PLAN.md

---

### B. FUNNEL METRICS (Weekly)

#### 7. Email List Size and Weekly Growth
- **Track via**: Buttondown dashboard → Subscribers count
- **Formula**: `new_subs_this_week = total_subs_today - total_subs_last_Monday`
- 🟢 Green: +30+ new email subs/week by Month 2
- 🟡 Yellow: +10–29/week
- 🔴 Red: <10/week in Month 2+ = lead magnet not distributing. Check: Is the PDF link in every video description? Posted on LinkedIn/Reddit this week?

#### 8. Email Open Rate
- **Track via**: Buttondown analytics → Average open rate
- Target: ≥35% open rate
- 🟢 Green: ≥35%
- 🟡 Yellow: 25–34%
- 🔴 Red: <25% = subject lines broken or list has gone cold. Send a re-engagement campaign: "Are you still in?"

#### 9. Email → Community Conversion Rate
- **Definition**: (New community subs this week) / (Email list size last week) × 100
- Target: ≥0.3%/week (i.e., for every 1,000 email subs, 3+ convert to community monthly)
- Track manually: compare Razorpay new subs vs. email list
- 🔴 Red: <0.1%/week for 4 consecutive weeks = email content not selling the community

#### 10. Email → Mock Booking Conversion Rate
- **Definition**: Mock bookings this week / Email sends last week × 100
- Target: ≥1% on weeks with a mock CTA in the email
- 🔴 Red: 0 bookings for 3 consecutive weeks despite CTA in email = rewrite the CTA

---

### C. YOUTUBE METRICS (Weekly, from YouTube Studio)

#### 11. Click-Through Rate (CTR)
- **Location**: YouTube Studio → Content → each video → Analytics → Reach tab
- Target: ≥4% on long-form (industry average 2–10%; new channels typically 3–6%)
- 🟢 Green: ≥5% CTR
- 🟡 Yellow: 3–4.9% CTR
- 🔴 Red: <3% CTR = thumbnail/title problem. A/B test immediately.

**What to do if CTR is red**: Take your best-performing Short (944 views), study its thumbnail style, and apply the same pattern to long-form thumbnails. Bold text + face-reaction + contrast color + curiosity gap.

#### 12. Average View Duration (AVD)
- **Location**: YouTube Studio → Analytics → Engagement tab
- Target: ≥45% of video length for long-form (8-min video → 3:36 average)
- 🟢 Green: ≥50% AVD
- 🟡 Yellow: 35–49% AVD
- 🔴 Red: <35% AVD = hook is weak, or first 30 seconds has the cinematic opener problem (see expert-debate.md — the 30-second cinematic intro is hurting retention)

**What to do if AVD is red**: Check the audience retention graph. If there is a cliff at 0:00–0:30, cut the cinematic opener. Start with the answer/hook immediately.

#### 13. Absolute Audience Retention Rate at 30 Seconds (ATR@30s)
- **Location**: YouTube Studio → Video Analytics → Audience Retention curve
- Target: ≥70% of viewers still watching at 30 seconds
- 🔴 Red: <60% at 30 seconds = the first 30 seconds are losing viewers. This is the #1 reason for 2 views.

#### 14. Shorts Impressions and Views
- **Location**: YouTube Studio → Content → filter by Shorts
- Target: At least 1 Short per week reaching 1,000+ views
- 🟢 Green: Average Short reaching 500+ views
- 🔴 Red: Average Short <200 views = either Short hook is weak or posting cadence is wrong. Post at 7–9 AM IST or 7–9 PM IST for India timezone.

#### 15. Subscriber Growth Rate (Weekly)
- **Location**: YouTube Studio → Analytics → Audience tab → Subscribers
- 🟢 Green: +50+ subs/week by Month 3
- 🟡 Yellow: +20–49/week
- 🔴 Red: <10/week in Month 3+ = distribution is broken. Post on Reddit/LinkedIn same day as YouTube upload.

---

### D. COMMUNITY HEALTH METRICS (Weekly)

#### 16. Weekly Active Members (WAM)
- **Definition**: Unique Telegram members who posted or reacted in the last 7 days
- Target: ≥30% of community members are weekly active
- 🔴 Red: <20% WAM = community is dying. Urgently inject engagement: personal DMs, a provocative question post, a surprise bonus session.

#### 17. Group Mock Session Attendance
- **Definition**: Attendees at Wednesday voice session / Total community members × 100
- Target: ≥20% attendance (i.e., for 100 subs, 20 show up)
- 🔴 Red: <10% attendance = session time is wrong OR topic choice is wrong. Survey the community.

#### 18. Net Promoter Score Proxy
- **Measurement**: Monthly poll in Telegram: "How likely are you to recommend this community to a friend preparing for interviews? (1–10)"
- Target: Average ≥8
- 🔴 Red: Average <7 = serious product issue. Schedule 5 personal calls with members this week.

---

### E. CONTENT PIPELINE METRICS (Weekly)

#### 19. Videos Published This Week
- Target: 3 Shorts + 1 long-form/week (minimum), GHA automation handles rendering
- 🔴 Red: 0 long-form videos in 2 consecutive weeks = YouTube algorithm de-prioritizes channel

#### 20. Lead Magnet Distribution Points
- Did you post the PDF link this week on: YouTube description? Reddit? LinkedIn? Telegram?
- 🔴 Red: PDF not mentioned anywhere this week = email list growth stops

---

## WEEKLY REVIEW TEMPLATE (20 minutes every Sunday)

Copy this into a Google Sheet. Fill weekly.

```
Date: ___________

REVENUE
MRR: ₹_____  (Δ vs last week: +/-₹_____)
New community subs: ___  Churned: ___  Net: ___
Mock interviews booked: ___  Completed: ___  Revenue: ₹_____
Course sales: ___  Revenue: ₹_____
AdSense (if live): ₹_____
Affiliate: ₹_____
TOTAL WEEKLY REVENUE: ₹_____

FUNNEL
Email list size: _____  New this week: _____
Email open rate: _____%
Cal.com visits this week: _____  Bookings: _____
Website visitors (GoatCounter): _____

YOUTUBE
Long-form views this week: _____
Shorts views this week: _____
CTR (best video this week): _____%
AVD (best video this week): _____%
New subscribers this week: _____

COMMUNITY
Telegram members: _____
WAM: _____  (____% of members)
Mock session attendance: _____

RED LIGHTS THIS WEEK:
1.
2.

PRIORITY ACTION FOR NEXT WEEK:
1.
2.
3.
```

---

## DASHBOARD AUTOMATION WITH GITHUB ACTIONS

### Auto-pull Razorpay MRR to Google Sheet (weekly)
```yaml
# .github/workflows/weekly-kpi-pull.yml
name: Weekly KPI Pull
on:
  schedule:
    - cron: '0 20 * * 0'  # Sunday 8 PM IST (2:30 PM UTC)
jobs:
  pull-kpis:
    runs-on: ubuntu-latest
    steps:
      - name: Fetch Razorpay subscription count
        run: |
          SUBS=$(curl -s -u "${{ secrets.RAZORPAY_KEY }}:${{ secrets.RAZORPAY_SECRET }}" \
            "https://api.razorpay.com/v1/subscriptions?status=active&count=100" \
            | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['count'])")
          echo "Active subscriptions: $SUBS"
          echo "MRR: $(echo "$SUBS * 150" | bc) INR"
          # Append to tracking file
          echo "$(date +%Y-%m-%d),$SUBS,$(echo "$SUBS * 150" | bc)" >> kpi-log.csv
      
      - name: Fetch Buttondown subscriber count
        run: |
          COUNT=$(curl -s -H "Authorization: Token ${{ secrets.BUTTONDOWN_KEY }}" \
            "https://api.buttondown.email/v1/subscribers?status=active" \
            | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['count'])")
          echo "Email subscribers: $COUNT"
      
      - name: Commit KPI log
        run: |
          git config user.email "actions@github.com"
          git config user.name "GHA KPI Bot"
          git add kpi-log.csv
          git commit -m "Weekly KPI update $(date +%Y-%m-%d)" || echo "No changes"
          git push
```

---

## THE NUMBERS THAT PREDICT FAILURE (EARLY WARNING SYSTEM)

If any of these are true for 3 consecutive weeks, the plan needs a strategic pivot:

1. **Email list growing by <15/week in Month 2** → Lead magnet not reaching audience
2. **Zero mock interview bookings in any 2-week stretch after Month 2** → Cold outreach has stopped
3. **Community MRR declining 3 weeks in a row** → Churn exceeds acquisition
4. **Long-form videos averaging <50 views in Month 3** → SEO and thumbnail strategy broken
5. **Mock session attendance <5 people/week by Month 3** → Community isn't engaged enough to pay ₹150
