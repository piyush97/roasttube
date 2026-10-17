import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeParagraphs, stripAiDashes } from "../src/lib/gemini.ts";

test("normalizeParagraphs turns literal 'Paragraph N:' labels into breaks", () => {
  assert.equal(
    normalizeParagraphs("One.Paragraph 2: Two.\n\n\nThree."),
    "One.\n\nTwo.\n\nThree."
  );
  assert.equal(normalizeParagraphs("No labels here."), "No labels here.");
});

test("normalizeParagraphs upgrades single newlines to paragraph breaks", () => {
  assert.equal(
    normalizeParagraphs("First.\nSecond.\n\nThird."),
    "First.\n\nSecond.\n\nThird."
  );
});

test("stripAiDashes replaces em dashes with a comma", () => {
  assert.equal(
    stripAiDashes("a clean routine—you are lying"),
    "a clean routine, you are lying"
  );
});

test("stripAiDashes starts a sentence before an uppercase continuation", () => {
  assert.equal(
    stripAiDashes("his content — You should see it"),
    "his content. You should see it"
  );
});

test("stripAiDashes keeps number ranges as hyphens", () => {
  assert.equal(stripAiDashes("the 2020–2024 era"), "the 2020-2024 era");
});

test("stripAiDashes leaves existing sentence punctuation alone", () => {
  assert.equal(
    stripAiDashes("That was it. — and you know it"),
    "That was it. and you know it"
  );
});

test("stripAiDashes drops a dash that opens a paragraph", () => {
  assert.equal(stripAiDashes("First line.\n\n—Second line."), "First line.\n\nSecond line.");
});
