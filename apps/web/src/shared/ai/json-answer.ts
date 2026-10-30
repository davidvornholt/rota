import { Option, Schema } from 'effect';

const fencedBlock = /```(?:json)?\s*(?<content>[\s\S]*?)```/giu;
const decodeJson = Schema.decodeUnknownOption(
  Schema.fromJsonString(Schema.Unknown),
);
const isJson = (text: string): boolean => Option.isSome(decodeJson(text));

/** Skip prose braces, then decode enclosing candidates without rescuing children of an invalid candidate. */
const lastJsonContainer = (text: string): string | undefined => {
  const trimmed = text.trim();
  if (isJson(trimmed)) {
    return trimmed;
  }
  // A key quote or empty-object close distinguishes an object from a stray prose
  // brace, and a value start or empty-array close does the same for a bracket.
  const openings = /\{(?=\s*["}])|\[(?=\s*(?:[-\d"{[\]]|true|false|null))/gu;
  let last: string | undefined;
  for (
    let opening = openings.exec(trimmed);
    opening !== null;
    opening = openings.exec(trimmed)
  ) {
    const closing = opening[0] === '{' ? '}' : ']';
    let candidate: string | undefined;
    for (
      let end = trimmed.indexOf(closing, opening.index + 1);
      end !== -1;
      end = trimmed.indexOf(closing, end + 1)
    ) {
      const slice = trimmed.slice(opening.index, end + 1);
      if (isJson(slice)) {
        candidate = slice;
        openings.lastIndex = end + 1;
        break;
      }
    }
    if (candidate === undefined) {
      return undefined;
    }
    last = candidate;
  }
  return last;
};

/**
 * Claude sometimes writes its reasoning or a Markdown fence around the JSON it was asked for.
 * Preserves a complete JSON answer, otherwise prefers the last fenced block or container in prose.
 * Returns the trimmed text when extraction fails so schema decoding reports the invalid answer.
 */
export const jsonAnswer = (text: string): string => {
  const trimmed = text.trim();
  if (isJson(trimmed)) {
    return trimmed;
  }
  const fenced = Array.from(
    text.matchAll(fencedBlock),
    (match) => match.groups?.content,
  );
  const lastFenced = fenced.at(-1);
  return (
    (lastFenced === undefined ? undefined : lastJsonContainer(lastFenced)) ??
    lastJsonContainer(trimmed) ??
    trimmed
  );
};
