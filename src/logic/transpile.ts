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
}

const transpileSelectStatement = (influxQL: string): string => {
    influxQL = influxQL.replace(/\r|\n|\r\n/g, ' ').replace(/  +/g, ' ').trim();

    // const SELECT_REGEX = /^SELECT (.*) FROM (.*) WHERE (.*) GROUP BY (.*)$/i;
    const SELECT_REGEX = /^SELECT (.*) FROM (.*) WHERE (.*)$/i;

    const [, aggregation, from, where] = influxQL.match(SELECT_REGEX) ?? ['', '', '', ''];


    const fluxQuery: FluxSelectQuery = {
        bucket: '',
        range: {},
        filters: [],
    };


    // FROM
    const [, database, retention, measurement] = from.match(/^["']([^"']+)["'](?:\.["']([^"']+)["'])?(?:\.["']([^"']+)["'])?$/) ?? [];
    if (database)
        fluxQuery.bucket = database + (retention ? `/${retention}` : '');

    if (measurement)
        fluxQuery.filters.push({ field: '_measurement', operator: '==', value: measurement });


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

    return `
        from(bucket: "${query.bucket}")
        ${pipeline.map(step => `    |> ${step}`).join('\n')}
    `;
};
