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

    let statement: { [clause: string]: string, aggregation: string, from: string, where: string, group: string, fill: string } = {
        aggregation: '', from: '', where: '', group: '', fill: '',
    };

    const ranges: { clause: string, from: number, to: number }[] = [];
    const clauses: { statementKey: string, influxQLIdentifier: string, fromOffset: number, toOffset?: number }[] = [
        { statementKey: 'fill', influxQLIdentifier: 'FILL', fromOffset: 5, toOffset: -1 },
        { statementKey: 'group', influxQLIdentifier: 'GROUP BY', fromOffset: 9 },
        { statementKey: 'where', influxQLIdentifier: 'WHERE', fromOffset: 6 },
        { statementKey: 'from', influxQLIdentifier: 'FROM', fromOffset: 5 },
        { statementKey: 'aggregation', influxQLIdentifier: 'SELECT', fromOffset: 7 },
    ];


    let endIndex = influxQL.length;

    for (const clause of clauses) {
        const index = influxQL.toUpperCase().indexOf(clause.influxQLIdentifier);
        if (index !== -1) {
            ranges.push({ clause: clause.statementKey, from: index + clause.fromOffset, to: endIndex + (clause.toOffset ?? 0) });
            endIndex = index;
        }
    }

    for (const range of ranges) {
        statement[range.clause] = influxQL.substring(range.from, range.to).trim();
    }


    const fluxQuery: FluxSelectQuery = {
        bucket: '',
        range: {},
        filters: [],
        aggregateFunctions: [],
    };


    // FROM
    if (statement.from.toLowerCase().includes(' where'))
        statement.from = statement.from.substring(0, statement.from.toLowerCase().indexOf(' where'));

    const [, database, retention, measurement] = statement.from
        .match(/^["']([^"']+)["']\.?(?:["']([^"']+)["'])?(?:\.["']([^"']+)["'])?$/) ?? [];

    if (database)
        fluxQuery.bucket = database + (retention ? `/${retention}` : '');

    if (measurement)
        fluxQuery.filters.push({ field: '_measurement', operator: '==', value: `'${measurement}'` });


    // WHERE
    if (statement.where.includes('$timeFilter'))
        fluxQuery.range = {
            start: 'v.timeRangeStart',
            stop: 'v.timeRangeStop',
        };

    (statement.where.startsWith('(') ? statement.where.substring(1, statement.where.length - 1) : statement.where)
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
    statement.group = statement.group.trim();

    if (statement.group.length > 0) {
        if (statement.group === '*')
            fluxQuery.group = { columns: [] };

        else {
            const columns = statement.group
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

    const timeAggregation = statement.group.match(/time\(([0-9a-z]+)\)/i);
    if (timeAggregation)
        fluxQuery.aggregateWindow = {
            every: timeAggregation[1],
        };


    // AGGREGATION
    const aggregations = statement.aggregation
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
    if (statement.fill.length > 0)
        if (statement.fill.trim().toLowerCase() === 'previous')
            fluxQuery.fill = { previous: true, value: '' };
        else
            fluxQuery.fill = { previous: false, value: statement.fill.trim() };


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
