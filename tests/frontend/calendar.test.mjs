import test from 'node:test';
import assert from 'node:assert/strict';
import { dateKey, parseDate, monthCells, dayAppointments } from '../../src/front/utils/calendar.mjs';

test('local dates round-trip without UTC date shifts', () => {
    for (const key of ['2026-03-29', '2026-10-25', '2024-02-29', '2026-12-31']) {
        assert.equal(dateKey(parseDate(key)), key);
    }
});
test('all twelve months contain exactly their days in complete Monday-first rows', () => {
    for (let month = 0; month < 12; month++) {
        const cells = monthCells(2024, month);
        assert.equal(cells.length % 7, 0);
        assert.equal(cells.filter(Boolean).length, new Date(2024, month + 1, 0).getDate());
        assert.equal(cells.findIndex(Boolean), (new Date(2024, month, 1).getDay() + 6) % 7);
    }
});
test('day list keeps simultaneous appointments and sorts by time without mutating input', () => {
    const items = [{id:'b', date:'2026-04-24', time:'16:30'}, {id:'c', date:'2026-04-24', time:'10:00'},
        {id:'a', date:'2026-04-24', time:'10:00'}, {id:'d', date:'2026-04-25', time:'09:00'}];
    assert.deepEqual(dayAppointments(items, '2026-04-24').map(item => item.id), ['a', 'c', 'b']);
    assert.equal(items[0].id, 'b');
    assert.deepEqual(dayAppointments(items, '2026-04-26'), []);
});

test('every shared appointment links to an existing job and matching client', async () => {
    const { readFile } = await import('node:fs/promises');
    const load = async path => import(`data:text/javascript;base64,${Buffer.from(await readFile(new URL(path, import.meta.url), 'utf8')).toString('base64')}`);
    const { sharedAppointments } = await load('../../src/data/sharedAppointments.js');
    const { initialJobs } = await load('../../src/data/jobsMockData.js');
    const { initialClients } = await load('../../src/data/clientsMockData.js');
    for (const appointment of sharedAppointments) {
        const job = initialJobs.find(item => item.id === appointment.jobId);
        const client = initialClients.find(item => item.id === appointment.clientId);
        assert.ok(job, appointment.id);
        assert.ok(client, appointment.id);
        assert.equal(job.client.email, client.email);
        assert.equal(appointment.relatedJob, job.title);
    }
});
