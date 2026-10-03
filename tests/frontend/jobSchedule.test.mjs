import assert from "node:assert/strict";
import test from "node:test";

import { addDays, defaultJobSchedule, jobDate, jobMatchesStatus } from "../../src/front/utils/jobSchedule.mjs";

test("new jobs start today and default to delivery thirty days later", () => {
    assert.deepEqual(
        defaultJobSchedule(new Date(2026, 8, 28, 23, 30)),
        { startDate: "2026-09-28", dueDate: "2026-10-28" },
    );
});

test("job schedules cross month and year boundaries using local dates", () => {
    assert.equal(addDays("2026-12-15", 30), "2027-01-14");
});

test("pending job filter includes the draft status used for new jobs", () => {
    assert.equal(jobMatchesStatus("draft", "pending"), true);
    assert.equal(jobMatchesStatus("scheduled", "pending"), true);
    assert.equal(jobMatchesStatus("in_progress", "pending"), false);
});

test("job dates display the calendar day returned by the API", () => {
    assert.equal(jobDate("2026-10-05T00:00:00"), "2026-10-05");
    assert.equal(jobDate(null), "");
});
