import type { Pipeline, Stage } from './types';
import type { Clauses } from '../clauses/types';
import type { SelectClause } from '../clauses/types';
import type { WhereClause } from '../clauses/types';
import { removeUnnecessaryOuterBrackets } from '../clauses/utility/removeUnnecessaryOuterBrackets';

export const generatePipeline = (clauses: Clauses): Pipeline => {
    const pipeline: Pipeline = {
        filters: [],
        stages: [],
    };

    if (!clauses.select || !clauses.from)
        return pipeline;


    pipeline.from = {
        bucket: clauses.from.bucket,
        retention: clauses.from.retention,
    };

    if (clauses.from.measurement)
        pipeline.filters.push({ pattern: `$ == "${clauses.from.measurement}"`, fields: ['_measurement'] });


    const usedFields: string[] = clauses.select.star ? [] : getUsedFields(clauses.select.expressions);
    if (usedFields.length > 0) {
        pipeline.filters.push({
            pattern: usedFields.map(field => `$ == ${field}`).join(' or '),
            fields: new Array(usedFields.length).fill('_field'),
        });
    }


    if (clauses.where && clauses.where.filters) {
        if ('type' in clauses.where.filters && clauses.where.filters.type === 'and') {
            for (const variable of clauses.where.filters.variables)
                pipeline.filters.push(generateFilter(variable));

        } else {
            pipeline.filters.push(generateFilter(clauses.where.filters));
        }
    }


    for (const filter of pipeline.filters)
        if (filter.fields.length === 1 && filter.fields[0] === '_time') {
            let value = filter.pattern.substring(4).trim();

            if (value.replace('now()', '').trim().length > 0)
                value = value.replace(/now\(\)| /g, '');

            pipeline.range = { ...pipeline.range };

            if (filter.pattern.startsWith('$ <'))
                pipeline.range.stop = value;
            else if (filter.pattern.startsWith('$ >'))
                pipeline.range.start = value;
        }

    pipeline.filters = pipeline.filters.filter(filter => !(filter.fields.length === 1 && filter.fields[0] === '_time'));


    return pipeline;
};

const getUsedFields = (expressions: SelectClause.Expression[]): string[] => {
    const fields: string[] = [];

    for (const expression of expressions) {
        fields.push(...expression.fields);

        for (const fn of expression.functions)
            fields.push(...getUsedFields(fn.arguments));
    }

    return Array.from(new Set(fields));
};

const generateFilter = (variable: WhereClause.Condition | WhereClause.Filter): Stage.Filter => {
    const generateFilterPattern = (variable: WhereClause.Condition | WhereClause.Filter): string => {
        if ('type' in variable)
            return '(' + variable.variables.map(generateFilterPattern).join(` ${variable.type} `) + ')';

        return `${variable.fieldsPattern ?? '$'} ${variable.operator} ${variable.value}`;
    };

    const getFilterFields = (variable: WhereClause.Condition | WhereClause.Filter): string[] => {
        const fields: string[] = [];

        if ('type' in variable) {
            for (const v of variable.variables)
                fields.push(...getFilterFields(v));

        } else {
            fields.push(...variable.fields);
        }

        return fields;
    };

    const pattern = removeUnnecessaryOuterBrackets(generateFilterPattern(variable));
    const fields = getFilterFields(variable).map(f => f === 'time' ? '_time' : f);
    return { fields, pattern };
};

