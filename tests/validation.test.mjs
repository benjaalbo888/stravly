import { test } from "node:test";
import assert from "node:assert/strict";
import { bookingInput, integer, isClock, isDate } from "../src/lib/validation.ts";
import { BOOKING_DAYS, addDays, santiagoDate, timeLabel } from "../src/lib/schedule.ts";

test("validates real dates and quarter hours", () => {
  assert.equal(isDate("2028-02-29"), true);
  for (const input of ["2027-02-29", "2026-04-31", "2026-02-00", "2026-1-01", "0000-01-01"]) {
    assert.equal(isDate(input), false);
  }
  assert.equal(isClock("23:45"), true);
  assert.equal(isClock("24:00"), false);
  assert.equal(isClock("12:07"), false);
  assert.equal(integer("0", 0, 20), 0);
  assert.equal(integer("2e1", 0, 20), undefined);
});

test("uses Santiago dates on both sides of DST and advances calendar days", () => {
  assert.equal(santiagoDate(new Date("2026-07-10T03:59:00Z")), "2026-07-09");
  assert.equal(santiagoDate(new Date("2026-07-10T04:00:00Z")), "2026-07-10");
  assert.equal(santiagoDate(new Date("2026-12-10T03:00:00Z")), "2026-12-10");
  assert.equal(timeLabel("2026-12-10T03:00:00Z"), "00:00");
  assert.equal(addDays("2026-07-10", BOOKING_DAYS), "2026-09-08");
});

test("normalizes contact details and validates the server booking payload", () => {
  const form = new FormData();
  form.set("service", "3b037413-280e-4032-a364-e31f66f79a2d");
  form.set("start", "2026-12-08T14:00:00+00:00");
  form.set("name", "  Cliente Demo   ");
  form.set("email", "  DEMO@example.test  ");
  form.set("phone", " +56 9 (0000)-0000 ");
  assert.deepEqual(bookingInput(form), {
    service: "3b037413-280e-4032-a364-e31f66f79a2d", start: "2026-12-08T14:00:00+00:00",
    name: "Cliente Demo", email: "demo@example.test", phone: "+56900000000",
  });
  form.set("start", "2026-02-30T14:00:00Z");
  assert.equal(bookingInput(form), null);
});
