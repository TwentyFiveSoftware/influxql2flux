import { removeUnnecessaryOuterBrackets } from './utility/removeUnnecessaryOuterBrackets';
import { getMostOuterGroups } from './utility/getMostOuterGroups';
import { REGEX_COMPARISON_OPERATORS, REGEX_FIELD_IN_PATTERN, REGEX_NUMBER, REGEX_TIMESTAMP } from './regexs';

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

export const transpileWhereClause = (influxQL: string): WhereClause => {
    if (influxQL.trim().length === 0)
        return {};

    return { filters: parse(influxQL) };
};

const parse = (influxQL: string): Condition | Filter => {
    influxQL = removeUnnecessaryOuterBrackets(influxQL);

    const orGroups = getMostOuterGroups(influxQL, ' or ');
    if (orGroups.length > 1)
        return { type: 'or', variables: orGroups.map(parse) } as Condition;

    const andGroups = getMostOuterGroups(influxQL, ' and ');
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
    const left = influxQL.split(REGEX_COMPARISON_OPERATORS)[0].trim();

    let fieldsPattern: string = left;

    const fields: string[] = [];
    for (const fieldMatch of left.matchAll(REGEX_FIELD_IN_PATTERN)) {
        const field: string = fieldMatch[1] ?? fieldMatch[2] ?? fieldMatch[3] ?? fieldMatch[0];

        if (field.toLowerCase() === 'true' || field.toLowerCase() === 'false')
            continue;

        fields.push(field.includes(' ') ? `"${field}"` : field);
        fieldsPattern = fieldsPattern.replace(fieldMatch[0], '$');
    }

    fieldsPattern = fieldsPattern.replace(/  +/g, ' ');
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
