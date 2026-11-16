/**
 * Keywords the Claude API's structured outputs reject with a 400. `minItems`
 * is allowed only as 0 or 1 and is checked separately.
 */
const unsupportedKeywords = [
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minLength',
  'maxLength',
  'maxItems',
  'uniqueItems',
  'contains',
  'prefixItems',
  'patternProperties',
  'propertyNames',
];
const mostOptionalParameters = 24;
const mostUnionParameters = 16;

type Node = Readonly<Record<string, unknown>>;
type Located = readonly [Node, string];

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The problems with one schema node itself, not with the nodes inside it. */
const nodeProblems = (node: Node, path: string): ReadonlyArray<string> => [
  ...unsupportedKeywords
    .filter((keyword) => keyword in node)
    .map((keyword) => `${path}: ${keyword} is not supported`),
  ...('minItems' in node && node.minItems !== 0 && node.minItems !== 1
    ? [`${path}: minItems may only be 0 or 1`]
    : []),
  ...(isNode(node.properties) && node.additionalProperties !== false
    ? [`${path}: an object needs additionalProperties: false`]
    : []),
  ...(Array.isArray(node.type) && 'enum' in node
    ? [`${path}: an enum next to a type array is rejected`]
    : []),
];

const branchesOf = (node: Node, path: string): ReadonlyArray<Located> =>
  ['anyOf', 'allOf'].flatMap((keyword) => {
    const branches = node[keyword];
    return Array.isArray(branches)
      ? branches
          .filter(isNode)
          .map(
            (branch, index): Located => [
              branch,
              `${path}.${keyword}[${index}]`,
            ],
          )
      : [];
  });

/** Each schema node directly inside this one, with its path. */
const children = (node: Node, path: string): ReadonlyArray<Located> => [
  ...Object.entries(isNode(node.properties) ? node.properties : {}).flatMap(
    ([name, property]): ReadonlyArray<Located> =>
      isNode(property) ? [[property, `${path}.${name}`]] : [],
  ),
  ...(isNode(node.items) ? [[node.items, `${path}[]`] as const] : []),
  ...branchesOf(node, path),
];

const optionalCount = (node: Node): number => {
  if (!isNode(node.properties)) {
    return 0;
  }
  const required = new Set(Array.isArray(node.required) ? node.required : []);
  return Object.keys(node.properties).filter((name) => !required.has(name))
    .length;
};

/**
 * Why the API would reject this schema as a structured-output format, one
 * line per problem with its path; empty when it keeps to the supported subset.
 * See https://platform.claude.com/docs/en/build-with-claude/structured-outputs#json-schema-limitations.
 */
export const structuredOutputProblems = (
  schema: Node,
): ReadonlyArray<string> => {
  const problems: Array<string> = [];
  let optional = 0;
  let unions = 0;
  const visit = ([node, path]: Located): void => {
    problems.push(...nodeProblems(node, path));
    optional += optionalCount(node);
    unions += Array.isArray(node.type) || 'anyOf' in node ? 1 : 0;
    children(node, path).forEach(visit);
  };
  visit([schema, '$']);
  if (optional > mostOptionalParameters) {
    problems.push(
      `$: ${optional} optional parameters, at most ${mostOptionalParameters} allowed`,
    );
  }
  if (unions > mostUnionParameters) {
    problems.push(
      `$: ${unions} union-typed parameters, at most ${mostUnionParameters} allowed`,
    );
  }
  return problems;
};
