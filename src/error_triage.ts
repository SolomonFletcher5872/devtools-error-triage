import { call } from "./infrai_client.js";
// Canonical Infrai capability: errors.capture

type BuildFailure = { buildId: string; release: string; service: string; message: string; exception: string };
type Group = { id?: string; error_group_id?: string; title?: string; count?: number };
function validateBuildFailure(event: BuildFailure): void {
  const fields: Array<keyof BuildFailure> = ["buildId", "release", "service", "message", "exception"];
  if (event === null || typeof event !== "object" || fields.some((field) => typeof event[field] !== "string")) {
    throw new TypeError("Invalid build failure: expected string buildId, release, service, message, and exception");
  }
}

export function diagnosticFingerprint(event: Pick<BuildFailure, "service" | "release">): string[] {
  return [event.service, event.release];
}

export async function captureBuildFailure(event: BuildFailure): Promise<unknown> {
  validateBuildFailure(event);
  return call("POST", "/v1/errors/capture", {
    title: `${event.service} build failed`,
    message: event.message,
    level: "error",
    fingerprint: diagnosticFingerprint(event),
    exception: event.exception,
    context: { build_id: event.buildId, release: event.release, service: event.service }
  });
}

export async function listGroups(): Promise<Group[]> {
  return call("GET", "/v1/errors/groups");
}

export async function runOnce(): Promise<void> {
  const failure: BuildFailure = { buildId: `build-${Date.now()}`, release: "2026.09.03", service: "checkout-api", message: "database migration rejected", exception: "MigrationError: database migration rejected" };
  await captureBuildFailure(failure);
  const groups = await listGroups();
  const matching = groups.find((group) => group.title?.includes(failure.service));
  console.log(JSON.stringify({ captured: true, groupedError: matching?.error_group_id ?? matching?.id ?? null }));
}

if (import.meta.url === `file://${process.argv[1]}`) runOnce().catch((error) => { console.error(error.message); process.exitCode = 1; });
