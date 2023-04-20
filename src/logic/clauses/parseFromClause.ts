import type { FromClause } from './types';

export const parseFromClause = (influxQL: string): FromClause.Clause => {
    const fromClause: FromClause.Clause = {};

    influxQL = influxQL
        .trim()
        .split('.')
        .map(c => (c.length === 0 || c.match(/^["']([^"'.]+)["']$/) ? c : `"${c}"`))
        .join('.');

    const [, first, second, third] = influxQL.match(
        /^["']([^"'.]+)["']\.?(?:["']([^"'.]+)["'])?(?:\.["']([^"'.]+)["'])?$/,
    ) ?? [null, null, null, null];

    // https://docs.influxdata.com/influxdb/v1.3/query_language/data_exploration/#from-clause

    if (first && !second && !third) {
        // measurement only
        fromClause.measurement = first;
    } else if (first && second && third) {
        // fully qualified measurement (database_name.retention_policy_name.measurement_name)
        fromClause.bucket = first;
        fromClause.retention = second;
        fromClause.measurement = third;
    } else if (first && !second && third) {
        // default retention policy (database_name..measurement_name)
        fromClause.bucket = first;
        fromClause.measurement = third;
    }

    return fromClause;
};
