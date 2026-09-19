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
