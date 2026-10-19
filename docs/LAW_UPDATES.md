# How Aldune keeps up with changing law

1. **Dated rules.** Every rate and threshold is stored with an effective date (state, local, and industry minimum wages; exemption floors). Audits always use the rate in effect on each shift's date, so scheduled changes (e.g., January 1 minimum wages) apply automatically — no update needed.
2. **Rule packs for new law.** When a statute, ordinance, or rate is enacted, your compliance attorney publishes a versioned JSON rule pack (new dated rates, law-library text). Only items marked `attorney_verified` with a named verifier and an official source are applied; anything else is held for review.
3. **Distribution.** Your deployment serves the current pack at `/api/law-feed` (set `LAW_FEED_JSON` or `LAW_FEED_URL` in Vercel). Every customer's app checks the feed, applies new verified items, and re-runs their audit so exposure, findings, and documents update. Owners can also import a pack manually (Rule registry → Law updates).
4. **Traceability.** Each applied change is logged with its source and verifier; findings carry rule versions, and the methodology appendix records them.

Pack format: `{ "version": "2027.1", "published": "2026-12-01", "items": [{ "kind": "local_min_wage", "key": "Oakland", "effective": "2027-01-01", "rate": 17.95, "source": "City of Oakland notice", "verification_status": "attorney_verified", "verified_by": "Name, SBN" }] }`
Kinds: `state_min_wage`, `local_min_wage`, `industry_min_wage`, `computer_pro`, `law_topic`.
