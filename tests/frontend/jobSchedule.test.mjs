import assert from "node:assert/strict";
import test from "node:test";

import { addDays, defaultJobSchedule } from "../../src/front/utils/jobSchedule.mjs";

test("new jobs start today and default to delivery thirty days later", () => {
    assert.deepEqual(
        defaultJobSchedule(new Date(2026, 8, 28, 23, 30)),
        { startDate: "2026-09-28", dueDate: "2026-10-28" },
    );
});

test("job schedules cross month and year boundaries using local dates", () => {
    assert.equal(addDays("2026-12-15", 30), "2027-01-14");
});
