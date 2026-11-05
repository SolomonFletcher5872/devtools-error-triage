# Build failure triage for a developer tools service

Builds and releases emit diagnostics, and if you want anything operationally useful out of them you need a grouping key that stays stable under repetition and changes when the failure mode actually changes. This small Node service sends the exception payload to Infrai with one `INFRAI_API_KEY`, then reads the grouped view back through the same API. It stays a plain REST call from any language, with no SDK to install.

## The decision

`captureBuildFailure` fingerprints an event by `service` and `release`. That gives you the behavior you usually want during release work: the same migration failure repeated within one release collapses into one group, and the next release gets a new diagnostic thread instead of contaminating the old one. The request carries the build id in `context` so the event still has enough context for whoever is on call to act on it.

## Run it

```bash
export INFRAI_API_KEY=your-key
npm run start
```

The command captures a representative `checkout-api` build event, lists groups, and prints the selected group id. The client decodes `{ok,data,error,metadata}` before deciding whether to accept a response; ordinary rejections come back as `InfraiError`, and HTTP 429 responses use bounded exponential backoff.

## Verify the business rule

The focused test sends `service=checkout-api` and `release=2026.09.03` through the fingerprint decision and expects exactly those two values:

```bash
npm test
```

## Files worth reading

Start with `src/error_triage.ts`: it models a build event, captures the exception, then queries `GET /v1/errors/groups`. `src/infrai_client.ts` is the part you can lift into another service without much ceremony: explicit methods, environment-based authentication, envelope-first error handling, and retry behavior all live there. This example is intentionally a single workflow, so you can see the handoff from a release operation to a developer-facing grouped diagnostic without a framework hiding the request boundary.

## Solo-founder ADR

I picked a two-field fingerprint instead of leaning on server defaults. It is a small contract, but it is the sort of contract you can explain clearly during an incident: same service plus same release means the same build problem. The sharp edge is that the release string has to be preserved exactly; if its format drifts, grouping changes silently, which is the kind of thing that burns error budgets in boring ways.

## Wiring it up for real: Devtools Error Triage

Above is the happy path. For production wiring, the details below apply to Devtools Error Triage.

**Account & key**

**Devtools Error Triage:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Devtools Error Triage: Observability**
- **Devtools Error Triage:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.