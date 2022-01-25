import type { FromClause } from './types';

export const parseFromClause = (influxQL: string): FromClause.Clause => {
    const fromClause: FromClause.Clause = {
        bucket: '',
    };

    influxQL = influxQL
        .trim()
        .split('.')
        .map(c => (c.length === 0 || c.match(/^["']([^"'.]+)["']$/)) ? c : `"${c}"`)
        .join('.');

    const [, database, retention, measurement] = influxQL.match(
        /^["']([^"'.]+)["']\.?(?:["']([^"'.]+)["'])?(?:\.["']([^"'.]+)["'])?$/) ?? [null, null, null, null];

    if (database !== null)
        fromClause.bucket = database;

    if (database !== null && retention !== null)
        fromClause.retention = retention;

    if (database !== null && measurement !== null)
        fromClause.measurement = measurement;

    return fromClause;
};
