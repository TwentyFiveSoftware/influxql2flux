import type { FromClause } from './types';

export const parseFromClause = (influxQL: string): FromClause.Clause => {
    const fromClause: FromClause.Clause = {
        bucket: '',
    };

    influxQL = influxQL
        .split('.')
        .map(c => (c.length === 0 || c.match(/^["']([^"'.]+)["']$/)) ? c : `"${c}"`)
        .join('.');

    const [, database, retention, measurement] = influxQL
        .match(/^["']([^"'.]+)["']\.?(?:["']([^"'.]+)["'])?(?:\.["']([^"'.]+)["'])?$/) ?? [];

    if (database)
        fromClause.bucket = database;

    if (database && retention)
        fromClause.retention = retention;

    if (database && measurement)
        fromClause.measurement = measurement;

    return fromClause;
};
