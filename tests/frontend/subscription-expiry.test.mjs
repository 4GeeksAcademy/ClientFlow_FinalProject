import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { subscriptionService } from "../../src/front/services/subscriptionService.mjs";

test("plan activation keeps the existing company and never requests a trial", async () => {
    const previousFetch = globalThis.fetch;
    let request;
    globalThis.fetch = async (url, options) => {
        request = { url, options };
        return {
            ok: true,
            json: async () => ({ status: "active" }),
        };
    };

    try {
        await subscriptionService.activate({
            token: "token-123",
            companyId: 7,
            planId: 3,
        });
    } finally {
        globalThis.fetch = previousFetch;
    }

    assert.equal(request.url, "/api/subscriptions/activate");
    assert.equal(request.options.method, "POST");
    assert.equal(request.options.headers["X-Company-ID"], "7");
    assert.deepEqual(JSON.parse(request.options.body), {
        plan_id: 3,
        registration_mode: "mock_payment",
    });
});

test("expired protected routes redirect to plan selection", () => {
    const routes = readFileSync(
        new URL("../../src/front/routes.jsx", import.meta.url),
        "utf8"
    );
    const plans = readFileSync(
        new URL("../../src/front/pages/PlanSelection.jsx", import.meta.url),
        "utf8"
    );

    assert.match(routes, /data\.code === "subscription_required"/);
    assert.match(routes, /select-plan\?reason=expired/);
    assert.match(plans, /!renewalMode && <fieldset>/);
    assert.match(plans, /subscriptionService\.activate/);
});
