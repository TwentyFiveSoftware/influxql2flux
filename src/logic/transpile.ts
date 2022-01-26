import { parseClauses } from './clauses/parseClauses';
import { generateFlux } from './flux/generateFlux';
import { generatePipelines } from './flux/generatePipelines';

export const transpile = (influxQL: string): string =>
    generateFlux(generatePipelines(parseClauses(influxQL)));
