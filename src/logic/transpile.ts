export const transpile = (influxQL: string): string => {
    influxQL = influxQL.trim();

    if (influxQL.length === 0)
        return '';

    if (influxQL.toLowerCase().startsWith('select '))
        return transpileSelectStatement(influxQL);

    return '';
};


interface FluxSelectQuery {
    bucket: string;
    range: {
        start?: string;
        stop?: string;
    };
    filters: { field: string, operator: string, value: string }[];
    group?: {
        columns: string[]
    };
    aggregateWindow?: {
        every: string;
        fn?: string;
    };
    aggregateFunctions: string[];
    fill?: { previous: boolean, value: string };
}


const transpileSelectStatement = (influxQL: string): string => {
    influxQL = influxQL.replace(/\r|\n|\r\n/g, ' ').replace(/  +/g, ' ').trim();

    const SELECT_REGEX = /^SELECT (.*) FROM (.*) WHERE (.*) GROUP BY (.*) FILL\((.*)\)$/i;
    // const SELECT_REGEX = /^SELECT (.*) FROM (.*) WHERE (.*)$/i;

    let [, aggregation, from, where, group, fill] = influxQL.match(SELECT_REGEX) ?? ['', '', '', '', '', ''];


    const fluxQuery: FluxSelectQuery = {
        bucket: '',
        range: {},
        filters: [],
        aggregateFunctions: [],
    };


    // FROM
    const [, database, retention, measurement] = from.match(/^["']([^"']+)["'](?:\.["']([^"']+)["'])?(?:\.["']([^"']+)["'])?$/) ?? [];
    if (database)
        fluxQuery.bucket = database + (retention ? `/${retention}` : '');

    if (measurement)
        fluxQuery.filters.push({ field: '_measurement', operator: '==', value: `'${measurement}'` });


    // WHERE
    if (where.includes('$timeFilter'))
        fluxQuery.range = {
            start: 'v.timeRangeStart',
            stop: 'v.timeRangeStop',
        };

    (where.startsWith('(') ? where.substring(1, where.length - 1) : where)
        .split(/ AND /i)
        .map(condition => {
                let [, field, operator, value] = (condition.trim()
                    .match(/^["']?([^"'<>=!~]*)["']?[ ]*(=|<=|<|>|>=|<>|!=|=~|!~)[ ]*["']?([^"'<>=!~]*)["']?$/) ?? [])
                    .map(v => v.trim());

                if (!field || !operator || !value)
                    return null;

                if (field.includes(' '))
                    field = `'${field}'`;

                if (operator === ')')
                    operator = '==';

                if (operator !== '=~' && operator !== '!~' && !value.includes('now()') && field !== 'time')
                    value = `'${value}'`;

                if (value.includes('now()'))
                    value = value.replace('now()', '').trim();

                return { field, operator, value };
            },
        )
        .forEach(filter => {
            if (!filter)
                return;

            if (filter.field === 'time') {
                if (filter.operator === '>' || filter.operator === '>=')
                    fluxQuery.range.start = filter.value;

                else if (filter.operator === '<' || filter.operator === '<=')
                    fluxQuery.range.stop = filter.value;

            } else
                fluxQuery.filters.push(filter);
        });


    // GROUP
    group = group.trim();

    if (group.length > 0) {
        if (group === '*')
            fluxQuery.group = { columns: [] };

        else {
            const columns = group
                .split(',')
                .map(column => column.trim())
                .filter(column => !column.startsWith('time('))
                .map(column => {
                    const [, c] = column.match(/^["']?([^"']+)["']?$/) ?? ['', ''];
                    return `'${c}'`;
                });

            if (columns.length > 0)
                fluxQuery.group = { columns };
        }
    }

    const timeAggregation = group.match(/time\(([0-9a-z]+)\)/i);
    if (timeAggregation)
        fluxQuery.aggregateWindow = {
            every: timeAggregation[1],
        };


    // AGGREGATION
    const aggregations = aggregation
        .split(',')
        .map(a => {
            const [, fn, field] = a.trim().match(/^([a-z_]*)\(["']?([^"']*)["']?\)(?: *as +[a-z]+)?$/i) ?? ['', '', ''];
            return ({ fn: fn.toLowerCase(), field: `'${field}'` });
        })
        .filter(a => a.fn !== '');

    if (aggregations.length > 0 && fluxQuery.aggregateWindow) {
        fluxQuery.aggregateWindow.fn = aggregations[0].fn;
        fluxQuery.filters.push({ field: '_field', operator: '==', value: aggregations[0].field });
    }

    if (aggregations.length > 1)
        fluxQuery.aggregateFunctions.push(...aggregations.slice(1).map(a => a.fn));


    // FILL
    if (fill.length > 0)
        if (fill.trim().toLowerCase() === 'previous')
            fluxQuery.fill = { previous: true, value: '' };
        else
            fluxQuery.fill = { previous: false, value: fill.trim() };


    return generateFluxStatement(fluxQuery);
};

const generateFluxStatement = (query: FluxSelectQuery): string => {
    const pipeline: string[] = [];

    if (query.range.start && query.range.stop)
        pipeline.push(`range(start: ${query.range.start}, stop: ${query.range.stop})`);
    else if (query.range.start && !query.range.stop)
        pipeline.push(`range(start: ${query.range.start})`);
    else if (!query.range.start && query.range.stop)
        pipeline.push(`range(stop: ${query.range.stop})`);

    pipeline.push(...query.filters.map(filter => {
        const field = filter.field.startsWith('\'') ? `r[${filter.field}]` : `r.${filter.field}`;
        return `filter(fn: (r) => ${field} ${filter.operator} ${filter.value})`;
    }));

    if (query.group)
        pipeline.push(`group(${query.group.columns.length > 0 ? `columns: [${query.group.columns.join(', ')}]` : ''})`);

    if (query.aggregateWindow)
        pipeline.push(`aggregateWindow(every: ${query.aggregateWindow.every}${
            query.aggregateWindow.fn ? `, fn: ${query.aggregateWindow.fn}` : ''})`);

    pipeline.push(...query.aggregateFunctions.map(fn => `${fn}()`));

    if (query.fill)
        pipeline.push(query.fill.previous ? `fill(usePrevious: true)` : `fill(value: ${query.fill.value})`);

    return `
        from(bucket: "${query.bucket}")
        ${pipeline.map(step => `    |> ${step}`).join('\n')}
    `;
};
