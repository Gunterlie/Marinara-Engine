import assert from "node:assert/strict";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import {
  registerCapabilityPrivilegedRoutes,
  runCapabilityInternalRoute,
} from "../../packages/server/src/services/capability-packages/capability-route-registration.service.js";

process.env.ADMIN_SECRET = "internal-route-test-secret";
process.env.MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK = "true";

const app = Fastify();
const installed = {
  id: "test-package",
  manifest: { id: "test-package", name: "Test Package", permissions: ["routes"] },
} as never;

try {
  await registerCapabilityPrivilegedRoutes(
    app,
    installed,
    async (routes) => {
      routes.post("/probe", async () => ({ ok: true }));
    },
    { prefix: "/api/test-package" },
  );
  await app.ready();

  const external = await app.inject({ method: "POST", url: "/api/test-package/probe", payload: {} });
  assert.equal(external.statusCode, 403, "external requests without the admin secret remain rejected");

  const markerOnly = await app.inject({
    method: "POST",
    url: "/api/test-package/probe",
    headers: { "x-marinara-automatic-generation": "1" },
    payload: {},
  });
  assert.equal(markerOnly.statusCode, 403, "the scheduling marker is not authorization");

  const forgedInternalHeader = await app.inject({
    method: "POST",
    url: "/api/test-package/probe",
    headers: { "x-marinara-internal-route": "test-package" },
    payload: {},
  });
  assert.equal(forgedInternalHeader.statusCode, 403, "an external header cannot create internal authorization");

  const internal = await runCapabilityInternalRoute(app, "test-package", {
    method: "POST",
    url: "/api/test-package/probe",
    payload: {},
  });
  assert.equal(internal.statusCode, 200, "trusted internal route execution does not require the browser secret");
  assert.deepEqual(internal.json(), { ok: true });

  await assert.rejects(
    () => runCapabilityInternalRoute(app, "test-package", { method: "GET", url: "/api/chats" }),
    /must remain under \/api\/test-package/u,
  );
  console.info("Capability internal route regression passed.");
} finally {
  await app.close();
}
