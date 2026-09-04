import instrumentSerifItalicCss from '@fontsource/instrument-serif/400-italic.css?url';
import instrumentSerifCss from '@fontsource/instrument-serif/index.css?url';
import instrumentSansCss from '@fontsource-variable/instrument-sans/index.css?url';
import instrumentSansItalicCss from '@fontsource-variable/instrument-sans/wght-italic.css?url';

import appCss from '../../styles.css?url';

export type ApplicationStyleSheetHrefs = readonly [string, ...Array<string>];

/** The complete ordered stylesheet set for every Rota document. */
export const applicationStyleSheetHrefs: ApplicationStyleSheetHrefs = [
  instrumentSansCss,
  instrumentSansItalicCss,
  instrumentSerifCss,
  instrumentSerifItalicCss,
  appCss,
];
