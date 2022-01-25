import { parseClauses } from './clauses/parseClauses';
import { generateFlux } from './flux/generateFlux';
import { generatePipeline } from './flux/generatePipeline';

export const transpile = (influxQL: string): string =>
    generateFlux(generatePipeline(parseClauses(influxQL)));
