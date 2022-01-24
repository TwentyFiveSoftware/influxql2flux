import { removeUnnecessaryOuterBrackets } from './utility/removeUnnecessaryOuterBrackets';
import { getMostOuterGroups } from './utility/getMostOuterGroups';
import { REGEX_FIELD_IN_PATTERN, REGEX_TIME_INTERVAL } from './regexs';
import { matchInfluxFunctions } from './utility/matchInfluxFunction';

interface Fn {
    fn: string;
    arguments: Expression[];
}

export interface Expression {
    pattern: string;
    fields: string[];
    functions: Fn[];
}

interface SelectClause {
    star: boolean;
    expressions: Expression[];
}

export const transpileSelectClause = (influxQL: string): SelectClause => {
    const selectClause: SelectClause = {
        star: false,
        expressions: [],
    };

    const groups: string[] = getMostOuterGroups(influxQL, ',')
        .map(e => e.trim()).filter(e => e.length > 0);

    if (groups.length === 0 || groups.includes('*'))
        selectClause.star = true;
    else
        selectClause.expressions = groups.map(parse);

    return selectClause;
};

const parse = (influxQL: string): Expression => {
    const { functions, fnPattern } = parseFunctions(influxQL);
    const expression = parseExpression(fnPattern);

    return { pattern: expression.pattern, fields: expression.fields, functions };
};

const parseExpression = (influxQL: string): Expression => {
    influxQL = removeUnnecessaryOuterBrackets(influxQL);

    const timeIntervalMatch = influxQL.match(REGEX_TIME_INTERVAL);
    if (timeIntervalMatch && timeIntervalMatch.index === 0 && timeIntervalMatch[0].length === influxQL.length)
        return { pattern: influxQL, fields: [], functions: [] };


    let pattern: string = influxQL;
    const fields: string[] = [];

    for (const fieldMatch of influxQL.matchAll(REGEX_FIELD_IN_PATTERN)) {
        const field: string = fieldMatch[1] ?? fieldMatch[2] ?? fieldMatch[3] ?? fieldMatch[0];

        if (field.toLowerCase() === 'true' || field.toLowerCase() === 'false')
            continue;

        fields.push(`"${field}"`);
        pattern = pattern.replace(fieldMatch[0], '$');
    }

    pattern = pattern.replace(/  +/g, ' ').replaceAll('($)', '$');
    pattern = removeUnnecessaryOuterBrackets(pattern);

    return { pattern, fields, functions: [] };
};

const parseFunctions = (influxQL: string): { functions: Fn[], fnPattern: string } => {
    const functions = matchInfluxFunctions(influxQL)
        .sort((a, b) => a.fromIndex - b.fromIndex);

    let fnPattern = '';
    let currIndex = 0;

    for (const fn of functions) {
        fnPattern += influxQL.substring(currIndex, fn.fromIndex) + '#';
        currIndex = fn.toIndex + 1;
    }

    fnPattern += influxQL.substring(currIndex);

    return { functions: functions.map(fn => ({ fn: fn.fn, arguments: fn.arguments.map(parse) })), fnPattern };
};
