import type { Pipeline, PipelineStage } from './types';
import type { Clauses } from '../clauses/types';
import type { SelectClause } from '../clauses/types';
import type { WhereClause } from '../clauses/types';
import { removeUnnecessaryOuterBrackets } from '../clauses/utility/removeUnnecessaryOuterBrackets';

export const generatePipeline = (clauses: Clauses): Pipeline => {
    const pipeline: Pipeline = {
        stages: [],
    };

    if (!clauses.select || !clauses.from)
        return pipeline;


    const bucket = `"${clauses.from.bucket}${clauses.from.retention ? `/${clauses.from.retention}` : ''}"`;
    pipeline.stages.push({ fn: 'from', arguments: { bucket } });


    const filterStages: string[] = [];

    if (clauses.from.measurement)
        filterStages.push(`(r) => r._measurement == "${clauses.from.measurement}"`);


    const usedFields: string[] = clauses.select.star ? [] : getUsedFields(clauses.select.expressions);
    if (usedFields.length > 0)
        filterStages.push('(r) => ' + usedFields.map(field => `r._field == ${field}`).join(' or '));


    if (clauses.where && clauses.where.timeFilters.length > 0) {
        const rangeStage = generateRangeStage(clauses.where.timeFilters);
        if (rangeStage)
            pipeline.stages.push(rangeStage);
    }

    if (clauses.where && clauses.where.filters) {
        if ('type' in clauses.where.filters && clauses.where.filters.type === 'and') {
            for (const variable of clauses.where.filters.variables)
                filterStages.push(generateFilterStage(variable));

        } else
            filterStages.push(generateFilterStage(clauses.where.filters));
    }

    pipeline.stages.push(...filterStages.map(fn => ({ fn: 'filter', arguments: { fn } })));


    if (clauses.groupBy) {
        if (clauses.groupBy.timeInterval) {
            pipeline.stages.push({
                fn: 'aggregateWindow',
                arguments: {
                    every: clauses.groupBy.timeInterval,
                    fn: 'mean',
                },
            });
        }

        if (clauses.groupBy.columns.length > 0) {
            pipeline.stages.push({
                fn: 'group',
                arguments: {
                    columns: `[${clauses.groupBy.columns.join(', ')}]`,
                    mode: '"by"',
                },
            });
        }
    }


    if (clauses.fill && (clauses.fill.usePrevious || clauses.fill.value.length > 0)) {
        pipeline.stages.push({
            fn: 'fill',
            arguments: clauses.fill.usePrevious ? { usePrevious: 'true' } : { value: clauses.fill.value },
        });
    }


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

const generateFilterStage = (variable: WhereClause.Condition | WhereClause.Filter): string => {
    const generateFilterFunction = (variable: WhereClause.Condition | WhereClause.Filter): string => {
        if ('type' in variable)
            return '(' + variable.variables.map(generateFilterFunction).join(` ${variable.type} `) + ')';

        let pattern = variable.fieldsPattern ?? '$';
        for (let field of variable.fields) {
            field = field === 'time' ? '_time' : field;
            pattern = pattern.replace('$', field.startsWith('"') ? `r[${field}]` : `r.${field}`);
        }

        return `${pattern} ${variable.operator} ${variable.value}`;
    };

    return '(r) => ' + removeUnnecessaryOuterBrackets(generateFilterFunction(variable));
};

const generateRangeStage = (timeFilters: WhereClause.Filter[]): PipelineStage | null => {
    let rangeStage: PipelineStage = { fn: 'range', arguments: {} };

    for (const filter of timeFilters)
        if (filter.operator === '>' || filter.operator === '>=')
            rangeStage.arguments.start = filter.value;
        else if (filter.operator === '<' || filter.operator === '<=')
            rangeStage.arguments.stop = filter.value;

    if (!('start' in rangeStage.arguments || 'stop' in rangeStage.arguments))
        return null;

    return rangeStage;
};
