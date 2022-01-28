import type { GroupByClause } from './types';
import { getMostOuterGroups } from './utility/getMostOuterGroups';
import { matchInfluxFunctions } from './utility/matchInfluxFunction';

export const parseGroupByClause = (influxQL: string): GroupByClause.Clause => {
    const groupByClause: GroupByClause.Clause = {
        columns: [],
        star: false,
    };


    const split = getMostOuterGroups(influxQL, ',')
        .map(c => c.trim().match(/^["']?([^"']*)["']?$/i))
        .map(c => c ? c[1].trim() : null)
        .filter(c => c !== null && c.length > 0) as string[];

    let columns: string[] = [];

    for (const column of split) {
        const functions = matchInfluxFunctions(column);

        if (functions.length === 0) {
            columns.push(column);
            continue;
        }

        const fn = functions[0];

        if (!(fn.fn === 'time' && fn.arguments.length > 0))
            continue;

        if (fn.arguments[0].toLowerCase() === '$interval') {
            groupByClause.timeInterval = 'v.windowPeriod';

        } else {
            const interval = fn.arguments[0].match(/(-?[0-9]+(?:\.[0-9]+)?(?:y|mo|w|d|h|m|s|ms|us|µs|ns)?)/i);
            groupByClause.timeInterval = interval ? interval[1] : '';
        }
    }


    if (columns.length === 1 && columns[0] === '*')
        groupByClause.star = true;

    columns = columns.filter(c => c !== '*').map(c => `"${c}"`);
    groupByClause.columns = columns;

    return groupByClause;
};
