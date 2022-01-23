export interface Filter {
    fields: string[];
    fieldsPattern?: string;
    operator: string;
    value: string;
}

export interface Condition {
    type: 'and' | 'or',
    variables: (Condition | Filter)[];
}

interface WhereClause {
    filters?: Condition | Filter;
}

const REGEX_NUMBER = /^(-?[0-9]+(?:\.[0-9]+)?)$/;
const REGEX_TIMESTAMP = /^([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z)$/;
const REGEX_COMPARISON_OPERATORS = /<=|>=|<>|!=|=~|!~|<|>|==|=/;

export const transpileWhereClause = (influxQL: string): WhereClause => {
    if (influxQL.trim().length === 0)
        return {};

    return { filters: parse(influxQL) };
};

const parse = (influxQL: string): Condition | Filter => {
    influxQL = removeUnnecessaryOuterBrackets(influxQL);

    const orGroups = getMostOuterGroups(influxQL, 'or');
    if (orGroups.length > 1)
        return { type: 'or', variables: orGroups.map(parse) } as Condition;

    const andGroups = getMostOuterGroups(influxQL, 'and');
    if (andGroups.length > 1)
        return { type: 'and', variables: andGroups.map(parse) } as Condition;

    return parseFilter(influxQL);
};

const parseFilter = (influxQL: string): Filter => {
    const { fields, fieldsPattern } = formatFields(influxQL);
    const operator = formatOperator(influxQL);
    const value = formatValue(influxQL, operator);

    if (fieldsPattern === '$')
        return { fields, operator, value } as Filter;

    return { fields, fieldsPattern, operator, value } as Filter;
};

const formatFields = (influxQL: string): { fields: string[], fieldsPattern: string } => {
    const left = influxQL.split(REGEX_COMPARISON_OPERATORS)[0];

    let fieldsPattern: string = left.trim();

    const fields: string[] = [];
    for (const fieldMatch of left.trim().matchAll(/([a-zA-Z_]+)|"([^"]+)"|'([^']+)'/gi)) {
        const field: string = fieldMatch[1] ?? fieldMatch[2] ?? fieldMatch[3] ?? fieldMatch[0];

        if (field.toLowerCase() === 'true' || field.toLowerCase() === 'false')
            continue;

        fields.push(field.includes(' ') ? `"${field}"` : field);
        fieldsPattern = fieldsPattern.replace(fieldMatch[0], '$');
    }

    fieldsPattern = fieldsPattern.replace(/  +/g, ' ').trim();
    fieldsPattern = removeUnnecessaryOuterBrackets(fieldsPattern);

    return { fields, fieldsPattern };
};

const formatOperator = (influxQL: string): string => {
    const operatorMatch = influxQL.match(REGEX_COMPARISON_OPERATORS);
    if (!operatorMatch)
        return '==';

    let operator = operatorMatch[0];
    if (operator === '=')
        operator = '==';

    if (operator === '<>')
        operator = '!=';

    return operator;
};

const formatValue = (influxQL: string, operator: string): string => {
    let value = (influxQL.split(REGEX_COMPARISON_OPERATORS)[1] ?? '').trim();

    const valueMatch =
        value.match(/^'([^']*)'$/) ??
        value.match(/^"([^"]*)"$/) ??
        value.match(REGEX_NUMBER);

    if (valueMatch)
        value = valueMatch[1];

    if (!value.match(REGEX_NUMBER) &&
        !value.match(REGEX_TIMESTAMP) &&
        !(operator === '=~' || operator === '!~') &&
        !value.includes('now()'))
        value = `"${value}"`;

    return value;
};

const getMostOuterGroups = (influxQL: string, connective: 'and' | 'or'): string[] => {
    const groups: string[] = [];

    let currentGroupStartIndex = 0;
    let bracketStack = 0;
    for (let i = 0; i < influxQL.length; i++) {
        if (influxQL.charAt(i) === '(')
            bracketStack++;
        else if (influxQL.charAt(i) === ')')
            bracketStack--;

        if (bracketStack === 0 && influxQL.substring(i).match(new RegExp(`^ ${connective} `, 'i'))) {
            groups.push(influxQL.substring(currentGroupStartIndex, i));
            currentGroupStartIndex = i + ` ${connective} `.length;
        }
    }

    groups.push(influxQL.substring(currentGroupStartIndex));

    return groups;
};

const removeUnnecessaryOuterBrackets = (influxQL: string): string => {
    while (influxQL.startsWith('(') && influxQL.endsWith(')')) {
        const newInfluxQL = influxQL.trim().substring(1, influxQL.length - 1).trim();

        let bracketStack = 0;
        for (let i = 0; i < newInfluxQL.length; i++) {
            if (newInfluxQL.charAt(i) === '(')
                bracketStack++;
            else if (newInfluxQL.charAt(i) === ')')
                bracketStack--;

            if (bracketStack < 0)
                break;
        }

        if (bracketStack < 0)
            break;

        influxQL = newInfluxQL;
    }

    return influxQL;
};
