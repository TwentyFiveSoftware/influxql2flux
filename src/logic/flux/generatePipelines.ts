import type { Pipeline, PipelineStage } from './types';
import { Clauses, SelectClause, WhereClause, FillClause, FromClause, GroupByClause } from '../clauses/types';
import { removeUnnecessaryOuterBrackets } from '../clauses/utility/removeUnnecessaryOuterBrackets';
import { fluxFunctionLookupTable } from './fluxFunctionLookupTable';

export const generatePipelines = (clauses: Clauses): Pipeline[] => {
    if (!clauses.select || !clauses.from)
        return [];

    const pipelines: Pipeline[] = [];

    const columnsToKeep: string[] = ['"_time"', '"_value"', ...(clauses.groupBy?.columns ?? [])];

    const aggregationStagesPerSelectExpression = generateAggregationStages(clauses);
    const aggregationStageSplits = aggregationStagesPerSelectExpression.flat().map(splitAtFirstAggregationFunction);

    if (aggregationStageSplits.length <= 1) {
        const aggregationStages = aggregationStageSplits[0];
        const aggregationPipelineStages: PipelineStage[] = [];

        if (aggregationStages)
            aggregationPipelineStages.push(...aggregationStages.before);

        aggregationPipelineStages.push(...generateTimeAggregationStage(clauses.groupBy, aggregationStages?.fn));

        if (aggregationStages?.fn?.fn)
            aggregationPipelineStages.push(aggregationStages.fn);

        if (aggregationStages)
            aggregationPipelineStages.push(...aggregationStages.after);


        pipelines.push({
            stages: [
                ...generateFromStage(clauses.from),
                ...generateRangeStage(clauses.where),
                ...generateFilterStageFromFields(getRequiredFieldInExpressions(clauses.select.expressions)),
                ...generateFilterStages(clauses),
                ...generateGroupByStage(clauses.groupBy),
                ...aggregationPipelineStages,
                ...generateFillStage(clauses.fill),
                { fn: 'keep', arguments: { columns: `[${columnsToKeep.join(', ')}]` } },
            ],
        });


    } else {
        pipelines.push({
            outputVariableName: 'data',
            stages: [
                ...generateFromStage(clauses.from),
                ...generateRangeStage(clauses.where),
                ...generateFilterStageFromFields(getRequiredFieldInExpressions(clauses.select.expressions)),
                ...generateFilterStages(clauses),
                ...generateGroupByStage(clauses.groupBy),
                ...generateFillStage(clauses.fill),
            ],
        });


        const lastStageOfSelectExpressionIndices = aggregationStagesPerSelectExpression.map((e) => e.length)
            .map((e, i, a) => a.slice(0, i + 1).reduce((sum, c) => sum + c, 0));

        const subPipelineVariableNames: string[] = [];

        for (let i = 0; i < aggregationStageSplits.length; i++) {
            const aggregationStages = aggregationStageSplits[i];

            const outputVariableName = `data_field_${i + 1}`;
            if (lastStageOfSelectExpressionIndices.includes(i + 1))
                subPipelineVariableNames.push(outputVariableName);

            const isFirstFnUnion = aggregationStages.before[0]?.fn === 'union';

            pipelines.push({
                inputVariableName: isFirstFnUnion ? undefined : 'data',
                outputVariableName,
                stages: [
                    ...aggregationStages.before,
                    ...generateTimeAggregationStage(clauses.groupBy, aggregationStages.fn),
                    ...(aggregationStages.fn?.fn ? [aggregationStages.fn] : []),
                    ...aggregationStages.after,
                    { fn: 'set', arguments: { key: '"_field"', value: `"${outputVariableName}"` } },
                ],
            });
        }

        if (subPipelineVariableNames.length === 1) {
            pipelines[pipelines.length - 1].outputVariableName = undefined;
            pipelines[pipelines.length - 1].stages.pop();
            pipelines[pipelines.length - 1].stages.push(
                { fn: 'keep', arguments: { columns: `[${columnsToKeep.join(', ')}]` } },
            );

        } else {
            pipelines.push({
                stages: [
                    {
                        fn: 'union',
                        arguments: { tables: `[${subPipelineVariableNames.join(', ')}]` },
                    },
                    {
                        fn: 'pivot',
                        arguments: { rowKey: '["_time"]', columnKey: '["_field"]', valueColumn: '"_value"' },
                    },
                    {
                        fn: 'keep',
                        arguments: {
                            columns: `[${[...columnsToKeep.filter(c => c !== '"_value"'),
                                ...subPipelineVariableNames.map(c => `"${c}"`)].join(', ')}]`,
                        },
                    },
                ],
            });
        }
    }


    pipelines.forEach(p => {
        p.stages = p.stages.filter(stage => stage.fn.length > 0);
    });

    return pipelines;
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

const getRequiredFieldInExpressions = (expressions: SelectClause.Expression[]): string[] => {
    const fields: string[] = [];

    for (const expression of expressions.filter(e => e)) {
        fields.push(...expression.fields);

        for (const fn of expression.functions)
            fields.push(...getRequiredFieldInExpressions(fn.arguments));
    }

    return Array.from(new Set(fields));
};

const generateFilterStageFromFields = (fields: string[]): PipelineStage[] => {
    if (fields.length === 0)
        return [];

    return [{
        fn: 'filter',
        arguments: {
            fn: '(r) => ' + fields.map(field =>
                `r._field == ${field.startsWith('"') ? field : `"${field}"`}`).join(' or '),
        },
    }];
};

const generateFilterStages = (clauses: Clauses): PipelineStage[] => {
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

    if (fn)
        return [{ fn: 'aggregateWindow', arguments: { every: groupByClause.timeInterval, fn } }];

    return [];
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

const generateAggregationStages = (clauses: Clauses): PipelineStage[][][] => {
    const linearizeExpression = (expression: SelectClause.Expression): PipelineStage[][] => {
        const pipelines: PipelineStage[][] = [];

        for (const fn of expression.functions) {
            pipelines.push(
                ...fn.arguments
                    .filter(a => a.functions.length > 0 || a.fields.length > 0)
                    .map(linearizeExpression).flat(),
            );

            if (pipelines.length > 0)
                pipelines[pipelines.length - 1].push(mapInfluxToFluxFunction(fn));
            else
                pipelines.push([mapInfluxToFluxFunction(fn)]);
        }

        let pipeline: PipelineStage[] = [];

        const requiredVariables = (new Array(expression.functions.length).fill(0))
            .map((_, i) => `data_field_${pipelines.length - i + currentVariableIndexOffset}`).reverse();

        if (requiredVariables.length === 1) {
            pipeline.push(...(pipelines.pop() ?? []));
            pipeline = pipeline.filter(stage => stage.fn !== 'filter');

        } else if (requiredVariables.length >= 2) {
            pipeline.push({ fn: 'union', arguments: { tables: `[${requiredVariables.join(', ')}]` } });
        }

        if (pipeline[0]?.fn !== 'union' && requiredFieldsInAllExpressions) {
            const requiredFields = getRequiredFieldInExpressions([expression]);
            if (requiredFields.length !== requiredFieldsInAllExpressions.length)
                pipeline.unshift(...generateFilterStageFromFields(requiredFields));
        }

        let pattern = expression.pattern;

        if (expression.fields.length + expression.functions.length >= 2) {
            for (const field of expression.fields)
                pattern = pattern.replace('$', field.startsWith('"') ? `r[${field}]` : `r.${field}`);

            if (expression.functions.length >= 2)
                for (const variable of requiredVariables)
                    pattern = pattern.replace('#', `r.${variable}`);

            if (!pipeline.some(stage => stage.fn === 'pivot'))
                pipeline.push({
                    fn: 'pivot',
                    arguments: { rowKey: '["_time"]', columnKey: '["_field"]', valueColumn: '"_value"' },
                });
        }

        if (pattern !== '$' && pattern !== '#') {
            pattern = pattern.replace(/[$#]/g, 'r._value');

            pipeline.push({
                fn: 'map',
                arguments: { fn: `(r) => ({ r with _value: ${pattern} })` },
            });
        }

        if (pipeline.length > 0)
            pipelines.push(pipeline);

        return pipelines;
    };


    if (!clauses.select || clauses.select.star)
        return [];

    const requiredFieldsInAllExpressions = getRequiredFieldInExpressions(clauses.select.expressions);

    let currentVariableIndexOffset = 0;
    return clauses.select.expressions.map((e) => {
        const exp = linearizeExpression(e);
        currentVariableIndexOffset += exp.length;
        return exp;
    });
};

const splitAtFirstAggregationFunction = (stages: PipelineStage[]):
    { before: PipelineStage[], fn?: PipelineStage, after: PipelineStage[] } => {

    const index = stages.findIndex(stage => Object.values(fluxFunctionLookupTable).map(f => f.fluxFnName).includes(stage.fn));

    if (index === -1)
        return { before: stages, after: [] };

    return { before: stages.slice(0, index), fn: stages[index], after: stages.slice(index + 1) };
};

const mapInfluxToFluxFunction = (fn: SelectClause.Fn): PipelineStage => {
    const influxFnName = fn.fn.toLowerCase();
    const args = fn.arguments.filter(a => a.fields.length === 0 && a.functions.length === 0).map(a => a.pattern);

    const fluxFn = fluxFunctionLookupTable[influxFnName];
    return { fn: fluxFn?.fluxFnName ?? '_', arguments: fluxFn?.argsMapping ? fluxFn.argsMapping(args) : {} };
};

