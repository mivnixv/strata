import { DslParser } from './dsl/parser.js';
import { DslFormatter } from './dsl/formatter.js';

export function parseStrata(source) { return new DslParser().parse(source); }
export function formatStrata(model) { return new DslFormatter().format(model); }
