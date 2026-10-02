import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("registration does not suggest a developer name", () => {
    const register = source("src/front/pages/Register.jsx");
    assert.doesNotMatch(register, /placeholder="Carlos"/);
    assert.doesNotMatch(register, /placeholder="Alberto"/);
});

test("internal job and client identifiers are not rendered", () => {
    const jobs = source("src/front/pages/Jobs.jsx");
    const jobDetail = source("src/front/pages/JobDetail.jsx");
    const clients = source("src/front/pages/Clients.jsx");
    const clientDetail = source("src/front/pages/ClientDetail.jsx");
    for (const page of [jobs, jobDetail, clients, clientDetail]) {
        assert.doesNotMatch(page, />ID:\s*\{/);
    }
    assert.doesNotMatch(clients, /Cliente", locale\)} #\{client\.id\}/);
});

test("knowledge page uses theme tokens for dark mode", () => {
    const css = source("src/front/styles/knowledge.css");
    assert.match(css, /color:var\(--cf-text\)/);
    assert.match(css, /background:var\(--cf-surface\)/);
    assert.match(css, /border:1px solid var\(--cf-border\)/);
});

test("custom workspaces include readable dark theme rules", () => {
    const agents = source("src/front/pages/Agents.css");
    const inbox = source("src/front/pages/Inbox.css");
    const members = source("src/front/styles/members.css");
    assert.doesNotMatch(agents, /color-scheme:\s*light/);
    assert.match(agents, /background: var\(--cf-workspace-bg\)/);
    assert.match(inbox, /data-bs-theme="dark"/);
    assert.match(members, /data-bs-theme="dark"/);
});

test("lead search icon has a centered fixed hit area", () => {
    const leads = source("src/front/pages/Leads.jsx");
    assert.match(leads, /justify-content-center p-0/);
    assert.match(leads, /minWidth: "2\.75rem"/);
});

test("job scheduling uses API field names without timezone shifts", () => {
    const jobs = source("src/front/pages/Jobs.jsx");
    const jobDetail = source("src/front/pages/JobDetail.jsx");
    assert.match(jobs, /scheduled_start: newJob\.startDate/);
    assert.match(jobs, /scheduled_end: newJob\.dueDate/);
    assert.match(jobDetail, /displayDate\(job\.scheduled_start\)/);
    assert.match(jobDetail, /displayDate\(job\.scheduled_end\)/);
});

test("client creation keeps actions visible and client details can create next actions", () => {
    const clients = source("src/front/pages/Clients.jsx");
    const detail = source("src/front/pages/ClientDetail.jsx");
    const service = source("src/front/services/clientService.js");
    assert.match(clients, /maxHeight: "calc\(100vh - 1rem\)"/);
    assert.match(clients, /modal-footer[^\n]*flex-shrink-0/);
    assert.match(detail, /createNextAction/);
    assert.match(service, /\/clients\/\$\{clientId\}\/next-actions/);
});

test("job details expose overall status and stage creation", () => {
    const detail = source("src/front/pages/JobDetail.jsx");
    assert.match(detail, /id="job-status"/);
    assert.match(detail, /\/api\/jobs\/\$\{id\}\/stages/);
    assert.match(detail, /createStage/);
});

test("company brand and dark dashboard controls use shared theme tokens", () => {
    const app = source("src/front/context/AppContext.jsx");
    const theme = source("src/front/theme.css");
    const dashboard = source("src/front/components/Dashboard/InteractiveCharts.jsx");
    assert.match(app, /--cf-brand/);
    assert.match(theme, /dashboard-breakdown-item/);
    assert.match(dashboard, /dashboard-breakdown-item/);
});

test("production invitations return a shareable secure link", () => {
    const members = source("src/front/pages/Members.jsx");
    assert.match(members, /invitation_url/);
    assert.match(members, /navigator\.clipboard\.writeText/);
});
