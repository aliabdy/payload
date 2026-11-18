import { expect, test } from "vitest";
import { findMatches, MAX_SEARCH_MATCHES } from "./search";

test("finds every case-insensitive match with its range", () => {
  expect(findMatches("Foo foo FOO", "foo").ranges).toEqual([
    { start: 0, end: 3 },
    { start: 4, end: 7 },
    { start: 8, end: 11 },
  ]);
});

test("an empty query finds nothing", () => {
  expect(findMatches("anything", "")).toEqual({ ranges: [], capped: false });
  expect(findMatches("", "anything")).toEqual({ ranges: [], capped: false });
});

test("treats regular-expression characters literally", () => {
  const { ranges } = findMatches("a.b axb a.b", "a.b");
  expect(ranges).toEqual([
    { start: 0, end: 3 },
    { start: 8, end: 11 },
  ]);
});

test("caps the number of matches and reports it", () => {
  const text = "ab ".repeat(MAX_SEARCH_MATCHES + 5);
  const result = findMatches(text, "ab");
  expect(result.ranges).toHaveLength(MAX_SEARCH_MATCHES);
  expect(result.capped).toBe(true);
});

test("does not report capped when every match fits", () => {
  expect(findMatches("ab ab", "ab")).toEqual({
    ranges: [
      { start: 0, end: 2 },
      { start: 3, end: 5 },
    ],
    capped: false,
  });
});
