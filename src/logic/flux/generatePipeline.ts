import type { Pipeline, PipelineStage } from './types';
import type { Clauses } from '../clauses/types';
import type { SelectClause } from '../clauses/types';
import type { WhereClause } from '../clauses/types';
import { removeUnnecessaryOuterBrackets } from '../clauses/utility/removeUnnecessaryOuterBrackets';
import { FillClause, FromClause, GroupByClause } from '../clauses/types';

export const generatePipeline = (clauses: Clauses): Pipeline => {
    const pipeline: Pipeline = {
        stages: [],
    };

    if (!clauses.select || !clauses.from)
        return pipeline;

    pipeline.stages.push(...generateFromStage(clauses.from));
    pipeline.stages.push(...generateRangeStage(clauses.where));
    pipeline.stages.push(...generateFilterStages(clauses));
    pipeline.stages.push(...generateTimeAggregationStage(clauses.groupBy));
    pipeline.stages.push(...generateGroupByStage(clauses.groupBy));
    pipeline.stages.push(...generateFillStage(clauses.fill));

    return pipeline;
};

const generateFromStage = (fromClause?: FromClause.Clause): PipelineStage[] => {
    if (!fromClause)
        return [];

    const bucket = `"${fromClause.bucket}${fromClause.retention ? `/${fromClause.retention}` : ''}"`;
    return [{ fn: 'from', arguments: { bucket } }];
};

const generateRangeStage = (whereClause?: WhereClause.Clause): PipelineStage[] => {
    if (!whereClause || whereClause.timeFilters.length === 0)
        return [];

    let rangeStage: PipelineStage = { fn: 'range', arguments: {} };

    for (const filter of whereClause.timeFilters)
        if (filter.operator === '>' || filter.operator === '>=')
            rangeStage.arguments.start = filter.value;
        else if (filter.operator === '<' || filter.operator === '<=')
            rangeStage.arguments.stop = filter.value;

    if (!('start' in rangeStage.arguments || 'stop' in rangeStage.arguments))
        return [];

    return [rangeStage];
};

const generateFilterStages = (clauses: Clauses): PipelineStage[] => {
    const getUsedFields = (expressions: SelectClause.Expression[]): string[] => {
        const fields: string[] = [];

        for (const expression of expressions) {
            fields.push(...expression.fields);

            for (const fn of expression.functions)
                fields.push(...getUsedFields(fn.arguments));
        }

        return Array.from(new Set(fields));
    };

    const generateFilterStage = (variable: WhereClause.Condition | WhereClause.Filter): string => {
        const generateFilterFunction = (variable: WhereClause.Condition | WhereClause.Filter): string => {
            if ('type' in variable)
                return '(' + variable.variables.map(generateFilterFunction).join(` ${variable.type} `) + ')';

            let pattern = variable.fieldsPattern ?? '$';
            for (let field of variable.fields) {
                field = field === 'time' ? '_time' : field;
                pattern = pattern.replace('$',
                    field.startsWith('"') ? `r[${field}]` : `r.${field}`);
            }

            return `${pattern} ${variable.operator} ${variable.value}`;
        };

        return '(r) => ' + removeUnnecessaryOuterBrackets(generateFilterFunction(variable));
    };


    const filterStages: string[] = [];

    if (clauses.from?.measurement)
        filterStages.push(`(r) => r._measurement == "${clauses.from.measurement}"`);

    if (clauses.select) {
        const usedFields: string[] = clauses.select.star ? [] : getUsedFields(clauses.select.expressions);
        if (usedFields.length > 0)
            filterStages.push('(r) => ' + usedFields.map(field => `r._field == ${field}`).join(' or '));
    }

    if (clauses.where && clauses.where.filters) {
        if ('type' in clauses.where.filters && clauses.where.filters.type === 'and') {
            for (const variable of clauses.where.filters.variables)
                filterStages.push(generateFilterStage(variable));

        } else
            filterStages.push(generateFilterStage(clauses.where.filters));
    }

    return filterStages.map(fn => ({ fn: 'filter', arguments: { fn } }));
};

const generateGroupByStage = (groupByClause?: GroupByClause.Clause): PipelineStage[] => {
    if (!groupByClause || groupByClause.columns.length === 0)
        return [];

    return [{
        fn: 'group',
        arguments: {
            columns: `[${groupByClause.columns.join(', ')}]`,
            mode: '"by"',
        },
    }];
};

const generateTimeAggregationStage = (groupByClause?: GroupByClause.Clause): PipelineStage[] => {
    if (!groupByClause || !groupByClause.timeInterval)
        return [];

    return [{
        fn: 'aggregateWindow',
        arguments: {
            every: groupByClause.timeInterval,
            fn: 'mean',
        },
    }];
};

const generateFillStage = (fillClause?: FillClause.Clause): PipelineStage[] => {
    if (!fillClause || (!fillClause.usePrevious && fillClause.value.length === 0))
        return [];

    return [{
        fn: 'fill',
        arguments: fillClause.usePrevious
            ? { usePrevious: 'true' }
            : { value: fillClause.value },
    }];
};
