import { Option, Schema } from 'effect';

const fencedBlock = /```(?:json)?\s*(?<content>[\s\S]*?)```/giu;
const decodeJson = Schema.decodeUnknownOption(
  Schema.fromJsonString(Schema.Unknown),
);
const isJson = (text: string): boolean => Option.isSome(decodeJson(text));

/** The whole text when it is JSON, otherwise the last `{…}` slice that ends at the last `}` and parses. */
const lastJsonObject = (text: string): string | undefined => {
  const trimmed = text.trim();
  if (isJson(trimmed)) {
    return trimmed;
  }
  const end = trimmed.lastIndexOf('}');
  for (let start = end; start >= 0; start -= 1) {
    if (trimmed[start] === '{') {
      const slice = trimmed.slice(start, end + 1);
      if (isJson(slice)) {
        return slice;
      }
    }
  }
  return undefined;
};

/**
 * Claude sometimes writes its reasoning or a Markdown fence around the JSON it was asked for.
 * Returns the JSON part of the answer, preferring the last fenced block, or the trimmed text when no JSON object is found.
 */
export const jsonAnswer = (text: string): string => {
  const fenced = Array.from(
    text.matchAll(fencedBlock),
    (match) => match.groups?.content,
  );
  const lastFenced = fenced.at(-1);
  return (
    (lastFenced === undefined ? undefined : lastJsonObject(lastFenced)) ??
    lastJsonObject(text) ??
    text.trim()
  );
};
