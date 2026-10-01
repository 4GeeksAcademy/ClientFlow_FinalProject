import assert from "node:assert/strict";
import test from "node:test";

import { readApiJson } from "../../src/front/services/response.mjs";

test("API parsing replaces HTML responses with a useful error", async () => {
    const response = new Response("<!doctype html><title>Not found</title>", {
        status: 404,
        headers: { "content-type": "text/html" },
    });

    await assert.rejects(
        readApiJson(response, "Unable to load the requested data."),
        (error) => error.message === "Unable to load the requested data." && error.status === 404
    );
});

test("API parsing preserves structured error codes", async () => {
    const response = new Response(JSON.stringify({
        message: "Your subscription is inactive or expired.",
        code: "subscription_required",
    }), {
        status: 403,
        headers: { "content-type": "application/json" },
    });

    await assert.rejects(
        readApiJson(response),
        (error) => error.code === "subscription_required" && error.status === 403
    );
});
