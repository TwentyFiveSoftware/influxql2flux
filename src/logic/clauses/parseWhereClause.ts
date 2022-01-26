import type { WhereClause } from './types';
import { removeUnnecessaryOuterBrackets } from './utility/removeUnnecessaryOuterBrackets';
import { getMostOuterGroups } from './utility/getMostOuterGroups';
import { REGEX_COMPARISON_OPERATORS, REGEX_FIELD_IN_PATTERN, REGEX_NUMBER, REGEX_TIMESTAMP } from './regexs';

export const parseWhereClause = (influxQL: string): WhereClause.Clause => {
    if (influxQL.trim().length === 0)
        return { timeFilters: [] };


    let filters = parse(influxQL);
    flattenNestedAndConditions(filters);

    const timeFilters = getTimeFilters(filters);

    filters = removeTimeFilters(filters);

    return { filters, timeFilters };
};

const parse = (influxQL: string): WhereClause.Filters => {
    influxQL = removeUnnecessaryOuterBrackets(influxQL);

    const orGroups = getMostOuterGroups(influxQL, ' or ');
    if (orGroups.length > 1)
        return { type: 'or', variables: orGroups.map(parse) } as WhereClause.Condition;

    const andGroups = getMostOuterGroups(influxQL, ' and ');
    if (andGroups.length > 1)
        return { type: 'and', variables: andGroups.map(parse) } as WhereClause.Condition;

    return parseFilter(influxQL);
};

const parseFilter = (influxQL: string): WhereClause.Filter => {
    const { fields, fieldsPattern } = formatFields(influxQL);
    const operator = formatOperator(influxQL);
    const value = formatValue(influxQL, operator);

    if (fieldsPattern === '$')
        return { fields, operator, value } as WhereClause.Filter;

    return { fields, fieldsPattern, operator, value } as WhereClause.Filter;
};

const formatFields = (influxQL: string): { fields: string[], fieldsPattern: string } => {
    const left = influxQL.split(REGEX_COMPARISON_OPERATORS)[0].trim();

    let fieldsPattern: string = left;

    const fields: string[] = [];
    for (const fieldMatch of left.matchAll(REGEX_FIELD_IN_PATTERN)) {
        let field: string = fieldMatch[1] ?? fieldMatch[2] ?? fieldMatch[3] ?? fieldMatch[0];

        if (field.toLowerCase() === 'true' || field.toLowerCase() === 'false')
            continue;

        field = field.toLowerCase() === 'time' ? '_time' : field;

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
        !value.includes('now()') &&
        value !== 'true' &&
        value !== 'false') {

        value = `"${value}"`;
    }

    return value;
};

const flattenNestedAndConditions = (condition: WhereClause.Filters): void => {
    if (!condition || !('type' in condition) || condition.type !== 'and')
        return;

    let nestedAndFound;
    do {
        nestedAndFound = false;

        for (let i = 0; i < condition.variables.length; i++) {
            const v = condition.variables[i];

            if ('type' in v && v.type === 'and') {
                condition.variables = [
                    ...condition.variables.slice(0, i),
                    ...v.variables,
                    ...condition.variables.slice(i + 1),
                ];

                nestedAndFound = true;
            }
        }
    } while (nestedAndFound);
};

const isTimeFilter = (filter: WhereClause.Filters) =>
    filter && 'fields' in filter && filter.fields.length === 1 && filter.fields[0] === '_time';

const removeTimeFilters = (filters: WhereClause.Filters): WhereClause.Filters => {
    if (filters && isTimeFilter(filters))
        return undefined;

    if (filters && 'type' in filters && filters.type === 'and') {
        filters.variables = filters.variables.filter(v => !isTimeFilter(v));

        if (filters.variables.length === 1) {
            return filters.variables[0];

        } else if (filters.variables.length === 0) {
            return undefined;
        }
    }

    return filters;
};

const getTimeFilters = (filters: WhereClause.Filters): WhereClause.Filter[] => {
    if (!filters)
        return [];

    const timeFilters: WhereClause.Filter[] = [];

    if (isTimeFilter(filters)) {
        timeFilters.push(filters as WhereClause.Filter);

    } else if (filters && 'type' in filters && filters.type === 'and') {
        timeFilters.push(...filters.variables.filter(isTimeFilter) as WhereClause.Filter[]);
    }

    return timeFilters.map(timeFilter => {
        const value = timeFilter.value.replace('now()', '').length === 0
            ? timeFilter.value
            : timeFilter.value.replace(/now\(\)| /g, '');

        return { fields: ['_time'], operator: timeFilter.operator, value };
    });
};
