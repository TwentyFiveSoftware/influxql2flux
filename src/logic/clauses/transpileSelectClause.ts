import { removeUnnecessaryOuterBrackets } from './utility/removeUnnecessaryOuterBrackets';
import { getMostOuterGroups } from './utility/getMostOuterGroups';
import { REGEX_TIME_INTERVAL } from './regexs';

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
    influxQL = removeUnnecessaryOuterBrackets(influxQL.trim());

    let pattern: string = influxQL;

    const timeIntervalMatch = pattern.match(REGEX_TIME_INTERVAL);
    if (timeIntervalMatch && timeIntervalMatch.index === 0 && timeIntervalMatch[0].length === pattern.length)
        return { pattern, fields: [], functions: [] };


    const fields: string[] = [];

    // TODO: move in dedicated method (duplicate code from where clause)
    for (const fieldMatch of influxQL.trim().matchAll(/([a-zA-Z_]+)|"([^"]+)"|'([^']+)'/gi)) {
        const field: string = fieldMatch[1] ?? fieldMatch[2] ?? fieldMatch[3] ?? fieldMatch[0];

        if (field.toLowerCase() === 'true' || field.toLowerCase() === 'false')
            continue;

        fields.push(`"${field}"`);
        pattern = pattern.replace(fieldMatch[0], '$');
    }

    pattern = pattern.replace(/  +/g, ' ').replaceAll('($)', '$').trim();
    pattern = removeUnnecessaryOuterBrackets(pattern).trim();

    return { pattern, fields, functions: [] };
};

const parseFunctions = (influxQL: string): { functions: Fn[], fnPattern: string } => {
    influxQL = removeUnnecessaryOuterBrackets(influxQL);

    const functions: Fn[] = [];

    while (true) {
        const fnMatch = influxQL.match(/[a-z0-9_]+ *\(/i);
        if (!fnMatch)
            break;


        const fnStartIndex = fnMatch.index ?? 0;
        let fnEndIndex = -1;

        let bracketStack = 0;
        for (let i = fnStartIndex; i < influxQL.length; i++) {
            if (influxQL.charAt(i) === '(')
                bracketStack++;
            else if (influxQL.charAt(i) === ')') {
                if (bracketStack === 1) {
                    fnEndIndex = i;
                    break;
                }

                bracketStack--;
            }
        }

        if (fnEndIndex === -1)
            break;

        const fn = influxQL.substring(fnStartIndex, fnEndIndex);
        const fnName = fn.split('(', 1)[0].trim().toLowerCase();
        const fnArguments = removeUnnecessaryOuterBrackets(fn.substring(fn.indexOf('(') + 1).trim()).split(',');

        functions.push({ fn: fnName, arguments: fnArguments.map(parse) });

        influxQL = influxQL.substring(0, fnStartIndex) + '#' + influxQL.substring(fnEndIndex + 1);
    }

    return { functions, fnPattern: influxQL };
};
