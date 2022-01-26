import type { Pipeline, PipelineStage } from './types';
import { Clauses, SelectClause, WhereClause, FillClause, FromClause, GroupByClause } from '../clauses/types';
import { removeUnnecessaryOuterBrackets } from '../clauses/utility/removeUnnecessaryOuterBrackets';
import { fluxFunctionLookupTable } from './fluxFunctionLookupTable';

export const generatePipeline = (clauses: Clauses): Pipeline => {
    const pipeline: Pipeline = {
        stages: [],
    };

    if (!clauses.select || !clauses.from)
        return pipeline;


    pipeline.stages.push(...generateFromStage(clauses.from));
    pipeline.stages.push(...generateRangeStage(clauses.where));
    pipeline.stages.push(...generateFilterStages(clauses));

    const aggregationStages = splitAtFirstAggregationFunction(generateAggregationStages(clauses));
    pipeline.stages.push(...aggregationStages.before);
    pipeline.stages.push(...generateTimeAggregationStage(clauses.groupBy, aggregationStages.fn));
    if (aggregationStages.fn?.fn)
        pipeline.stages.push(aggregationStages.fn);
    pipeline.stages.push(...aggregationStages.after);

    pipeline.stages.push(...generateGroupByStage(clauses.groupBy));
    pipeline.stages.push(...generateFillStage(clauses.fill));


    pipeline.stages = pipeline.stages.filter(stage => stage.fn.length > 0);

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
            for (const field of variable.fields)
                pattern = pattern.replace('$',
                    field.startsWith('"') ? `r[${field}]` : `r.${field}`);

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
            filterStages.push('(r) => ' + usedFields.map(field =>
                `r._field == ${field.startsWith('"') ? field : `"${field}"`}`).join(' or '));
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

const generateTimeAggregationStage = (groupByClause?: GroupByClause.Clause,
                                      aggregationFunction?: PipelineStage): PipelineStage[] => {

    if (!groupByClause || !groupByClause.timeInterval)
        return [];

    let fn: string | PipelineStage[] = '';

    if (aggregationFunction) {
        fn = aggregationFunction.fn;

        if (aggregationFunction && Object.keys(aggregationFunction?.arguments ?? []).length > 0)
            fn = [{ fn: aggregationFunction.fn, arguments: aggregationFunction.arguments }];

        aggregationFunction.fn = '';
    }

    return fn
        ? [{ fn: 'aggregateWindow', arguments: { every: groupByClause.timeInterval, fn } }]
        : [{ fn: 'aggregateWindow', arguments: { every: groupByClause.timeInterval } }];
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

const generateAggregationStages = (clauses: Clauses): PipelineStage[] => {
    const linearizeExpression = (expression?: SelectClause.Expression): PipelineStage[] => {
        const stages: PipelineStage[] = [];

        if (!expression)
            return stages;

        if (expression.functions.length > 0) {
            const fn = expression.functions[0];

            stages.push(...linearizeExpression(fn.arguments.find(a => a.functions.length > 0 || a.fields.length > 0)));

            stages.push(mapInfluxToFluxFunction(fn));
        }

        let pattern = expression.pattern;

        if (expression.fields.length > 1 || (expression.fields.length >= 1 && expression.functions.length >= 1)) {
            if (!stages.some(stage => stage.fn === 'pivot'))
                stages.push({
                    fn: 'pivot',
                    arguments: { rowKey: '["_time"]', columnKey: '["_field"]', valueColumn: '"_value"' },
                });

            for (const field of expression.fields)
                pattern = pattern.replace('$', field.startsWith('"') ? `r[${field}]` : `r.${field}`);

            // TODO: if more than one function, split the stream (aggregate each one with one of the functions)
            //       and join after the aggregations
        }

        if (pattern !== '$' && pattern !== '#') {
            pattern = pattern.replace(/[$#]/g, 'r._value');

            stages.push({
                fn: 'map',
                arguments: { fn: `(r) => ({ r with _value: ${pattern} })` },
            });
        }

        return stages;
    };

    if (!clauses.select || clauses.select.star || clauses.select.expressions.length !== 1)
        return [];


    return linearizeExpression(clauses.select.expressions[0]);
};

const splitAtFirstAggregationFunction = (stages: PipelineStage[]):
    { before: PipelineStage[], fn?: PipelineStage, after: PipelineStage[] } => {

    const index = stages.findIndex(stage => stage.fn !== 'map' && stage.fn !== 'pivot');

    if (index === -1)
        return { before: [], after: stages };

    return { before: stages.slice(0, index), fn: stages[index], after: stages.slice(index + 1) };
};

const mapInfluxToFluxFunction = (fn: SelectClause.Fn): PipelineStage => {
    const influxFnName = fn.fn.toLowerCase();
    const args = fn.arguments.filter(a => a.fields.length === 0 && a.functions.length === 0).map(a => a.pattern);

    const fluxFn = fluxFunctionLookupTable[influxFnName];
    return { fn: fluxFn?.fluxFnName ?? '_', arguments: fluxFn?.argsMapping ? fluxFn.argsMapping(args) : {} };
};

