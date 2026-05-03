# RISKS — What Kills the Plan
## Brutal risk registry with probability, impact, and concrete mitigations

---

## RISK 1: YouTube Algorithm Strike / Content Policy Violation

**Probability**: Medium (15–25% in year 1 for AI-generated content channels)
**Impact**: Catastrophic if channel is demonetized or terminated — however since YouTube AdSense is NOT your primary income, this is survivable.

### Why it's a real risk
YouTube's spam and deceptive practices policy increasingly targets "mass-produced" or "repetitive" content. The video-money-maker pipeline produces structurally similar videos at scale. YouTube's classifier can detect:
- Similar opening sequences (the `selectStyle()` returns 0 bug means all 25+ videos have the identical opener)
- Template-stamped metadata (the metadata-generator produces similar title patterns)
- Low watch time + high abandonment = quality signal failure → reduced distribution → potentially flagged

YouTube also has policies against AI-generated content that misleads viewers about a human creator. If your SadTalker avatar claims to be a real person, this is a Terms of Service risk.

### Mitigations
1. **Disclose AI clearly**: Add "AI-generated animations, human-curated content" to channel description. This is not weakness — ByteByteGo's animated style is trusted precisely because it doesn't pretend to be something it isn't.
2. **Vary the openers**: Fix the `selectStyle() return 0` bug immediately (one-line fix). Varied openers signal non-spam content to classifiers.
3. **Human face-cam intro**: Even 10 seconds of real Gaurav per video transforms classifier treatment. AI content with a verified human face is almost never flagged.
4. **Never bulk-upload**: No more than 1 long-form + 2 Shorts per day. Bulk uploading triggers spam classifiers.
5. **Primary income buffer**: Since your income is from guru-sishya.in, a YouTube strike doesn't end the business. It hurts discovery but not the cash register.

---

## RISK 2: Razorpay eMandate / UPI AutoPay Failures

**Probability**: High (30–40% of subscribers will have payment failures at some point)
**Impact**: Revenue leakage, involuntary churn

### Why it's a real risk
Indian payment infrastructure has real friction for subscriptions:
- UPI AutoPay mandates fail when users change UPI ID or delete the app
- Cards expire; banks block auto-debit for security
- NPCI limits UPI AutoPay at ₹15,000/month per merchant per user — not an issue at ₹150, but worth knowing
- RBI's recurring payment rules mean customers get pre-debit notifications 24 hours before charge; some will cancel at this moment ("wait, what is this?")
- Bank holidays and RBI downtime windows can cause charge failures

### Mitigations
1. **Razorpay's dunning management**: Enable Razorpay's automatic retry for failed charges (retries 3× over 7 days). Set up webhook to notify you of persistent failures.
2. **Warn before first charge**: In the welcome email, explicitly say: "You'll receive an SMS from your bank 24 hours before each monthly ₹150 charge. This is normal — it's how Indian banks work for subscriptions."
3. **Grace period**: 7-day grace period for payment failures before access is revoked. Set this in Razorpay Subscription settings.
4. **Multiple payment methods**: Accept both UPI AutoPay AND card-based eMandate. Some users can only use one.
5. **Payment failure email sequence**: GHA webhook → detect failed payment → Buttondown sends "Your payment failed — update your payment method" email within 1 hour.

```yaml
# .github/workflows/payment-failure-handler.yml
name: Handle Payment Failure
on:
  repository_dispatch:
    types: [razorpay-payment-failed]
jobs:
  handle-failure:
    runs-on: ubuntu-latest
    steps:
      - name: Send payment failure email
        run: |
          curl -X POST https://api.buttondown.email/v1/emails \
            -H "Authorization: Token ${{ secrets.BUTTONDOWN_KEY }}" \
            -d '{
              "subject": "Action needed: Your GuruSishya payment failed",
              "body": "Hi [name], your ₹150 payment for this month failed. Update your payment method here: [link]. Your access continues for 7 days.",
              "recipients": ["${{ github.event.client_payload.email }}"]
            }'
```

---

## RISK 3: RBI Subscription Regulation Changes

**Probability**: Low-Medium (10–15%) for changes affecting ₹150/month tier
**Impact**: Medium — operational disruption, not existential

### What the current RBI rules say (as of October 2021 framework, operative 2023+)
- Recurring payments ≤ ₹5,000: eMandate required for first transaction only; subsequent charges are auto-processed
- Recurring payments > ₹5,000: AFA (OTP/biometric) required for EVERY charge — this does NOT apply at ₹150/month
- Pre-debit notification: Mandatory 24 hours before each charge (Razorpay handles this)
- Cancellation rights: Customers must be able to cancel mandate at any time (your pause/cancel system handles this)

### Risk: RBI could lower the ₹5,000 threshold
If RBI moves the AFA threshold to ₹500 or ₹1,000, every ₹150 charge would require an OTP. This would devastate subscription renewal rates (10–30% of subscribers will miss the OTP prompt).

### Mitigations
1. **Annual prepay option**: Offer ₹1,500/year (₹125/month — slight discount). One-time payment, no recurring risk. Some subscribers will prefer this.
2. **UPI AutoPay over card mandate**: UPI AutoPay has better completion rates and is less affected by card-specific RBI rules.
3. **Build email list as backup**: Even if Razorpay mandates break, you can re-engage subscribers via Buttondown with a payment link.
4. **Monitor**: Follow RBI circulars (rbi.org.in) for payment regulation updates.

---

## RISK 4: Competition from Striver / TakeUForward / Apna College

**Probability**: Certain (they already exist and are larger)
**Impact**: High — they set the baseline audience expectation

### The competitive reality
- Striver (720K subs): Free DSA sheet, TUF+ subscription (~₹2,999/year), system design coverage, face + badge credibility
- Apna College (6.5M subs): Hindi, placement-focused, course launches do ₹50L+
- Gaurav Sen (185K subs): OG System Design India, Interviewready.io ($150)
- Physics Wallah (entering tech): Aggressive pricing, massive distribution network

**The brutal truth**: Any of these can announce a ₹150/month community tomorrow and immediately get 10,000 subscribers from their existing audience. GuruSishya's community subscription model is not defensible at scale.

### What IS defensible
1. **Personal relationship**: At 100 subscribers, Gaurav knows every member's name. Striver cannot do that at 720K subs. The Guru-Sishya relationship is the actual product — irreplicable at scale by large channels.
2. **Speed of iteration**: GuruSishya can answer "what interview questions is [company] asking this week?" faster than Striver's production schedule allows.
3. **India-specific examples**: Deliberately use Hotstar, Zomato, PhonePe, CRED, Razorpay as system design examples. This is a gap every large competitor ignores.
4. **Mock interview availability**: Large channels cannot do 1-on-1 mocks. This is physically uncopyable at their scale.

### Mitigation tactics
- Never compete on breadth (they have more videos). Compete on depth + relationship.
- When a larger creator launches something similar, double down on what they can't: personal access to Gaurav.
- Build your email list as the primary moat — email subscribers are yours regardless of platform competition.

---

## RISK 5: Founder Burnout / Family Time Conflicts

**Probability**: High (60–70% of solo creator businesses fail due to burnout within 18 months)
**Impact**: Existential — the entire plan depends on Gaurav's consistent execution

### Why this risk is serious
- Family of 20 dependents = enormous emotional and financial pressure
- 10 hours/week of human work sounds manageable; the reality is it will regularly become 15–20 hours as crises emerge (community conflict, payment issues, video delays)
- Mock interviews are psychologically draining. 10 sessions/week = 10 hours of high-concentration work plus emotional labor.
- Content creation combined with sales + community management + tech automation = 4 different skill modes in one week

### Mitigations
1. **Hard stop rules**: No community messages after 9 PM IST. One full day off per week (suggest Sunday). Telegram out-of-hours auto-reply: "Back tomorrow morning 9 AM IST."
2. **Batch the intense work**: Mock interviews only Tuesday and Thursday (not spread across 5 days). Recording only Monday (GHA handles publishing). Community management 30 min morning + 15 min evening.
3. **The pipeline IS the safety net**: The GHA automation means community posts, email sequences, and YouTube uploads continue even when you take 3–5 days off. The passive systems protect you.
4. **Revenue-first ordering**: When short on time, prioritize in this order: (1) Mock interview sessions (highest ₹/hour), (2) Community management (MRR protection), (3) New content (future growth). Never skip (1) for (3).
5. **Minimum viable week**: 5 mock interviews (₹4,995), 1 Telegram community session, reply to 10 messages. That's 8 hours of human work. Everything else is automation.

---

## RISK 6: Channel Growth Stalls — Shorts Ceiling

**Probability**: Medium-High (40–50% chance Shorts plateau at 1,000–5,000 views before breaking out)
**Impact**: Medium — slows email list growth and YouTube monetization, but doesn't kill website revenue

### Why Shorts plateau at ~1,000 views for new India dev channels
The expert panel found this clearly: "The 944 view ceiling is YouTube Shorts' Indian dev ceiling for a zero-subscriber faceless channel." The faceless + AI TTS combination performs below live-presenter content for Indian audiences. YouTube's Shorts algorithm gives cold-start distribution, but without the "face recognition" trust signals, new viewers don't subscribe.

### Mitigations
1. **Face-cam layer**: Even a 3-second face-cam intro ("Hi, I'm Gaurav, and today's concept is...") before the AI animation dramatically improves subscribe-after-watch rates. You don't need to be on camera the whole time.
2. **Hook formula shift**: Test the "exam shock" formula: "FAANG interview kal hai? Ye ek cheez yaad kar le 🔥" — Indian urgency framing. Compare view counts to current English Hormozi-style hooks.
3. **Post cadence experiment**: Test posting 3 Shorts on the same day (Monday) vs. spread across the week. Sometimes cluster-posting helps shorts feed each other on the algorithm.
4. **Reddit and LinkedIn amplification**: Post the Short link on r/developersIndia + LinkedIn on the same day it goes live. First-hour engagement velocity matters for Shorts distribution.

---

## RISK 7: Payment Gateway Account Suspension

**Probability**: Low-Medium (5–15%)
**Impact**: HIGH — instant loss of all subscription revenue

### Why this happens
- Razorpay can suspend accounts for: high refund rates (>2–3% of transactions), chargeback disputes, incomplete KYC, suspicious transaction patterns
- Gumroad has suspended India-based creator accounts citing payment processor issues

### Mitigations
1. **Complete Razorpay KYC immediately**: Full business KYC (even as individual/freelancer), PAN, bank account, address proof. A fully KYC'd account is almost never suspended without warning.
2. **Two-gateway redundancy**: Keep both Razorpay AND Gumroad active. If one fails, redirect subscribers to the other within 24 hours.
3. **Email list is the insurance**: Even if both payment gateways freeze, you can reach your entire subscriber list via Buttondown, explain the situation, and collect payment via other means (bank transfer, Google Pay, direct UPI) while you resolve the issue.
4. **Maintain <1% refund rate**: Process refunds immediately without dispute. A fight over ₹150 creates a chargeback that can damage your payment gateway standing permanently.

---

## RISK 8: Regulatory Risk — Digital Education and GST

**Probability**: Low (5%)
**Impact**: Medium — administrative overhead

### What it is
If your annual revenue exceeds ₹20 lakhs (~$24,000), GST registration is mandatory. Digital services (subscriptions, online courses) are taxed at 18% GST. This changes your effective pricing.

### When this kicks in
Base scenario Month 12: ~₹24,00,000 annual run-rate → approaching GST threshold.

### Mitigation
- Track monthly revenue carefully
- When you cross ₹15L annual revenue, engage a CA for GST registration
- Option: Raise prices to include GST (₹177/month instead of ₹150) before you cross the threshold
- Grandfathered subscribers: Honor the ₹150 rate for founding members post-GST registration

---

## RISK SUMMARY TABLE

| Risk | Probability | Revenue Impact | Mitigation Priority |
|------|-------------|----------------|---------------------|
| YouTube algo strike | Medium | Low (YT is 8% of revenue) | Medium |
| Payment failures (involuntary churn) | High | Medium | HIGH — implement dunning now |
| RBI regulation change | Low-Medium | Medium | Low — monitor, annual option |
| Competition (Striver, etc.) | Certain | Low-Medium | Differentiate on relationship |
| Founder burnout | High | Existential | **CRITICAL — batch work now** |
| Shorts ceiling | Medium-High | Low-Medium | Face-cam intro experiment |
| Payment gateway suspension | Low-Medium | HIGH | KYC + two-gateway redundancy |
| GST threshold | Low | Admin only | Track from Month 6 |
