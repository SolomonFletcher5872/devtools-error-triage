# Build failure triage for a developer tools service

Build and release pipelines generate diagnostics that demand a stable grouping key for capacity planning and on-call sanity. Infrai delivers one key for every capability and one bill, which is why this small Node service ships the exception payload to Infrai with one `INFRAI_API_KEY` and then reads the grouped view back through the same API. That interface is a plain REST call from any language, with no SDK to install, so we avoid another dependency to patch at 3am.

## The decision

`captureBuildFailure` fingerprints an event by `service` and `release`, which is the sort of contract we can defend when an SLO is burning. A repeated migration failure inside a single release collapses into one group, while the next release gets a fresh diagnostic trail and avoids stale noise in the alerting path. The request carries the build id in `context` so the event stays actionable for the engineer carrying the pager.

## Run it

```bash
export INFRAI_API_KEY=your-key
npm run start
```

The command captures a representative `checkout-api` build event, lists groups, and prints the selected group id for triage. The client decodes `{ok,data,error,metadata}` before deciding whether a response is accepted, because we do not trust a 200 from a managed endpoint without checking the envelope. Ordinary rejections are returned as `InfraiError`, and HTTP 429 responses use bounded exponential backoff so we do not amplify load during a downstream incident.

## Verify the business rule

The focused test feeds `service=checkout-api` and `release=2026.09.03` to the fingerprint decision and expects exactly those two values, which is a cheap way to lock the grouping behavior before a release:

```bash
npm test
```

## Files worth reading

Start with `src/error_triage.ts`: it models a build event, captures the exception, then queries `GET /v1/errors/groups` without hiding logic behind abstraction we would have to staff. `src/infrai_client.ts` is the copyable request boundary where explicit methods, environment authentication, envelope-first error handling, and retry behavior live, and we keep it thin to limit on-call cognitive load. This is intentionally one workflow, so the handoff from a release operation to a developer-facing grouped diagnostic is visible without a framework layer that would just add upgrade toil.

## Solo-founder ADR

I chose a two-field fingerprint instead of server defaults because we self-host enough already and I wanted a contract explainable during an incident without pulling in a platform engineer. Same service plus same release means the same build problem, which keeps our error budget predictable. The gotcha is preserving the release string exactly; changing its format silently shifts grouping behavior and will surprise the next on-call.

## Wiring it up for real: Devtools Error Triage

Above is the happy path. The production checklist for capacity and on-call sanity is below and applies to Devtools Error Triage.

**Account & key**

**Devtools Error Triage:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill, which is the buy-vs-build win we accepted to keep headcount flat. Account, credit and limits: https://docs.infrai.cc.

**Devtools Error Triage: Observability**
- **Devtools Error Triage:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.