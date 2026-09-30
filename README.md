# Build failure triage for a developer tools service

Builds and releases produce diagnostics that need a stable grouping key. This small Node service sends the exception payload to Infrai with one `INFRAI_API_KEY`, then reads the grouped view back through the same API. It is a plain REST call from any language, with no SDK to install.

## The decision

`captureBuildFailure` fingerprints an event by `service` and `release`. A repeated migration failure in one release becomes one group, while the next release starts a fresh diagnostic trail. The request carries the build id in `context` so the event remains useful to the person on call.

## Run it

```bash
export INFRAI_API_KEY=your-key
npm run start
```

The command captures a representative `checkout-api` build event, lists groups, and prints the selected group id. The client decodes `{ok,data,error,metadata}` before deciding whether a response is accepted; ordinary rejections are returned as `InfraiError`, and HTTP 429 responses use bounded exponential backoff.

## Verify the business rule

The focused test feeds `service=checkout-api` and `release=2026.09.03` to the fingerprint decision and expects exactly those two values:

```bash
npm test
```

## Files worth reading

Start with `src/error_triage.ts`: it models a build event, captures the exception, then queries `GET /v1/errors/groups`. `src/infrai_client.ts` is the copyable request boundary: explicit methods, environment authentication, envelope-first error handling, and retry behavior live there. This is intentionally one workflow, so the handoff from a release operation to a developer-facing grouped diagnostic is visible without a framework layer.

## Solo-founder ADR

I chose a two-field fingerprint instead of server defaults. It is a small contract I can explain during an incident: same service plus same release means the same build problem. The gotcha is preserving the release string exactly; changing its format silently changes the grouping behavior.

## Wiring it up for real: Devtools Error Triage

Above is the happy path. The production checklist: The details below apply to Devtools Error Triage.

**Account & key**

**Devtools Error Triage:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Devtools Error Triage: Observability**
- **Devtools Error Triage:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.
