import type { Clauses } from './types';
import { removeUnnecessaryOuterBrackets } from './utility/removeUnnecessaryOuterBrackets';
import { parseSelectClause } from './parseSelectClause';
import { parseFromClause } from './parseFromClause';
import { parseWhereClause } from './parseWhereClause';
import { parseGroupByClause } from './parseGroupByClause';
import { parseFillClause } from './parseFillClause';

export const parseClauses = (influxQL: string): Clauses => {
    influxQL = influxQL.replace(/[; ]+$/, '');
    influxQL = removeUnnecessaryOuterBrackets(influxQL);

    if (!influxQL.toLowerCase().startsWith('select '))
        return {};


    const clauses: Clauses = {};

    const clauseIdentifiers: { startsWith: string, endsWith: string[], fn: (c: string) => void }[] = [
        {
            startsWith: 'select', endsWith: ['from'], fn: (c) => {
                clauses.select = parseSelectClause(c);
            },
        },
        {
            startsWith: 'from', endsWith: ['where', 'group by', 'fill'], fn: (c) => {
                clauses.from = parseFromClause(c);
            },
        },
        {
            startsWith: 'where', endsWith: ['group by', 'fill'], fn: (c) => {
                clauses.where = parseWhereClause(c);
            },
        },
        {
            startsWith: 'group by', endsWith: ['fill'], fn: (c) => {
                clauses.groupBy = parseGroupByClause(c);
            },
        },
        {
            startsWith: 'fill', endsWith: [], fn: (c) => {
                clauses.fill = parseFillClause(c);
            },
        },
    ];


    let bracketStack = 0;
    let openQuote = '';

    for (let i = 0; i < influxQL.length; i++) {
        if (influxQL.charAt(i) === '(')
            bracketStack++;
        else if (influxQL.charAt(i) === ')')
            bracketStack--;

        if (bracketStack === 0 && influxQL.charAt(i) === '"')
            openQuote = openQuote === '"' ? '' : '"';
        else if (bracketStack === 0 && influxQL.charAt(i) === '\'')
            openQuote = openQuote === '\'' ? '' : '\'';


        if (!(bracketStack === 0 && openQuote === ''))
            continue;


        for (const clauseIdentifier of clauseIdentifiers) {
            const startRegex = new RegExp(`^${clauseIdentifier.startsWith}[( ]`, 'i');
            const endRegex = new RegExp(clauseIdentifier.endsWith.map(s => `^ ${s}[( ]`).join('|'), 'i');
            const isStringEnd = i + 1 === influxQL.length;
            const isFn = clauseIdentifier.endsWith.length === 0;

            let clause: string | null = null;

            if (isFn && influxQL.match(new RegExp(startRegex, 'i'))
                && (isStringEnd || influxQL.charAt(i) === ')')) {
                clause = influxQL.substring(0, Math.min(i + 1, influxQL.length));

            }

            if (!isFn && influxQL.match(startRegex) && (influxQL.substring(i).match(endRegex) || isStringEnd)) {
                clause = influxQL.substring(clauseIdentifier.startsWith.length + 1, i);
            }

            if (clause !== null) {
                clauseIdentifier.fn(clause);
                influxQL = influxQL.substring(i).trim() + ' ';
                i = -1;
                break;
            }
        }
    }

    if (!clauses.select || !clauses.from)
        return {};

    return clauses;
};
