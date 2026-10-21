# Performance

Practical constraints for this app:

- Prefer signed uploads for social media (avoid Vercel body size 413).
- Social cron: accept quickly and publish in background (`after()`); keep batch size small on Hobby.
- Public sites: `revalidate` on `/site/[slug]`; do not load whole inventory unbounded.
- Avoid stuffing large Markdown encyclopedias into agent context — use thin `context.md`.

No formal perf budget doc yet; measure in Vercel/browser when investigating slowness.
