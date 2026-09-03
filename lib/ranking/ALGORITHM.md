# Realidi ranking algorithm (MVP)

This engine is **deterministic and explainable**. It does not call a generative model.

## Score

```
score =
  0.45 * mood_match +
  0.20 * trust +
  0.15 * freshness +
  0.10 * proximity +
  0.10 * quality_engagement
```

Weights live in `ranking_config` (admin-editable). They are not hardcoded in UI components.

## Mood match (45%)

1. If the selected mood has community ratings for the place, use **Bayesian-smoothed** average:
   `(C * m + n * avg) / (C + n)` then divide by 5.
2. Blend with editorial `place_moods.weight` so a place with 2 ratings cannot outrun a place with 100.
3. If no ratings exist, fall back to editorial mood weight × place editorial/admin quality scores.

## Trust (20%)

Verified experience ratio (65%) + diminishing verified volume (35%).
Unverified content is not labelled fake; it simply contributes less trust.

This is **not** a public Trust Score.

## Freshness (15%)

Exponential decay from last published experience, half-life from config (default 21 days).
Places with no posts get a low but non-zero prior so editorial inventory still surfaces.

## Proximity (10%)

Linear decay inside the search radius. If the user has not shared a location, this term is **neutral (0.5)** so ranking does not punish them.

## Quality engagement (10%)

Weighted log-normalized:

`save * 4 + been_there * 3 + share * 2 + like * 1`

Watch time and follower count are **not** inputs.

## Confidence display

Never show fake precision such as 92.37%.

| Samples | Tier | UI |
| --- | --- | --- |
| < 5 | early_signal | Đang hình thành |
| 5–19 | emerging | Khớp tốt (if score high) |
| 20+ | established | Rất khớp (if score high) |

## Cold start

`editorial_score`, `admin_quality_score`, and category/mood editorial links keep new places visible.

## What this is not

- Not an LLM recommendation
- Not a popularity contest
- Not a paid placement slot (organic ranking is not for sale)
