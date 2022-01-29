import { generatePipelines } from './generatePipelines';
import type { Clauses } from '../clauses/types';
import type { Pipeline } from './types';

test('empty', () => {
    expect(generatePipelines({})).toEqual([]);
});

test('simple test', () => {
    const clauses: Clauses = {
        select: {
            star: false,
            expressions: [
                { pattern: '$', fields: ['ram_usage'], functions: [] },
            ],
        },
        from: { bucket: 'system' },
    };

    const pipelines: Pipeline[] = [{
        stages: [
            { fn: 'from', arguments: { bucket: '"system"' } },
            { fn: 'filter', arguments: { fn: '(r) => r._field == "ram_usage"' } },
            { fn: 'keep', arguments: { columns: '["_time", "_value"]' } },
            { fn: 'sort', arguments: { columns: '["_time"]' } },
        ],
    }];
    expect(generatePipelines(clauses)).toEqual(pipelines);
});

test('basic filter test', () => {
    const clauses: Clauses = {
        select: {
            star: false,
            expressions: [
                { pattern: '$', fields: ['cpu'], functions: [] },
            ],
        },
        from: { bucket: 'system', retention: 'autogen' },
        where: {
            filters: {
                type: 'and', variables: [
                    { fields: ['host'], operator: '=~', value: '/$host/' },
                    { fields: ['"data center"', 'nr'], fieldsPattern: '$ + $', operator: '!=', value: '"m-1"' },
                ],
            },
            timeFilters: [],
        },
    };

    const pipelines: Pipeline[] = [{
        stages: [
            { fn: 'from', arguments: { bucket: '"system/autogen"' } },
            { fn: 'filter', arguments: { fn: '(r) => r._field == "cpu"' } },
            { fn: 'filter', arguments: { fn: '(r) => r.host =~ /$host/' } },
            { fn: 'filter', arguments: { fn: '(r) => r["data center"] + r.nr != "m-1"' } },
            { fn: 'keep', arguments: { columns: '["_time", "_value"]' } },
            { fn: 'sort', arguments: { columns: '["_time"]' } },
        ],
    }];
    expect(generatePipelines(clauses)).toEqual(pipelines);
});

test('complex filter test', () => {
    const clauses: Clauses = {
        select: {
            star: false,
            expressions: [
                { pattern: '$', fields: ['cpu'], functions: [] },
            ],
        },
        from: { bucket: 'system', retention: 'autogen' },
        where: {
            filters: {
                type: 'and', variables: [
                    { fields: ['a'], operator: '>', value: '-3.5' },
                    {
                        type: 'or', variables: [
                            {
                                type: 'and', variables: [
                                    { fields: ['b'], operator: '==', value: '3' },
                                    { fields: ['c'], operator: '==', value: '"xxx"' },
                                ],
                            },
                            { fields: ['d'], fieldsPattern: '($ - 5) * 3', operator: '<', value: '100' },
                            { fields: ['e'], operator: '!=', value: '"frontend"' },
                        ],
                    },
                ],
            },
            timeFilters: [],
        },
    };

    const pipelines: Pipeline[] = [{
        stages: [
            { fn: 'from', arguments: { bucket: '"system/autogen"' } },
            { fn: 'filter', arguments: { fn: '(r) => r._field == "cpu"' } },
            { fn: 'filter', arguments: { fn: '(r) => r.a > -3.5' } },
            { fn: 'filter', arguments: { fn: '(r) => (r.b == 3 and r.c == "xxx") or (r.d - 5) * 3 < 100 or r.e != "frontend"' } },
            { fn: 'keep', arguments: { columns: '["_time", "_value"]' } },
            { fn: 'sort', arguments: { columns: '["_time"]' } },
        ],
    }];
    expect(generatePipelines(clauses)).toEqual(pipelines);
});

test('range (start only)', () => {
    const clauses: Clauses = {
        select: {
            star: false,
            expressions: [
                { pattern: '$', fields: ['usage'], functions: [] },
            ],
        },
        from: { bucket: 'system', measurement: 'cpu' },
        where: {
            timeFilters: [{ fields: ['_time'], operator: '>=', value: '-7d' }],
        },
    };

    const pipelines: Pipeline[] = [{
        stages: [
            { fn: 'from', arguments: { bucket: '"system"' } },
            { fn: 'range', arguments: { start: '-7d' } },
            { fn: 'filter', arguments: { fn: '(r) => r._field == "usage"' } },
            { fn: 'filter', arguments: { fn: '(r) => r._measurement == "cpu"' } },
            { fn: 'keep', arguments: { columns: '["_time", "_value"]' } },
            { fn: 'sort', arguments: { columns: '["_time"]' } },
        ],
    }];
    expect(generatePipelines(clauses)).toEqual(pipelines);
});

test('range (stop only)', () => {
    const clauses: Clauses = {
        select: {
            star: false,
            expressions: [
                { pattern: '$', fields: ['usage'], functions: [] },
            ],
        },
        from: { bucket: 'system', measurement: 'cpu' },
        where: {
            timeFilters: [{ fields: ['_time'], operator: '<', value: '2022-01-01T00:00:00Z' }],
        },
    };

    const pipelines: Pipeline[] = [{
        stages: [
            { fn: 'from', arguments: { bucket: '"system"' } },
            { fn: 'range', arguments: { stop: '2022-01-01T00:00:00Z' } },
            { fn: 'filter', arguments: { fn: '(r) => r._field == "usage"' } },
            { fn: 'filter', arguments: { fn: '(r) => r._measurement == "cpu"' } },
            { fn: 'keep', arguments: { columns: '["_time", "_value"]' } },
            { fn: 'sort', arguments: { columns: '["_time"]' } },
        ],
    }];
    expect(generatePipelines(clauses)).toEqual(pipelines);
});

test('range (nested time filter)', () => {
    const clauses: Clauses = {
        select: {
            star: false,
            expressions: [
                { pattern: '$', fields: ['a'], functions: [] },
            ],
        },
        from: { bucket: 'b' },
        where: {
            filters: {
                type: 'or', variables: [
                    { fields: ['_time'], operator: '<', value: '2022-01-01T00:00:00Z' },
                    { fields: ['"a a a"'], operator: '!=', value: '99' },
                ],
            },
            timeFilters: [{ fields: ['_time'], operator: '>', value: 'now()' }],
        },
    };

    const pipelines: Pipeline[] = [{
        stages: [
            { fn: 'from', arguments: { bucket: '"b"' } },
            { fn: 'range', arguments: { start: 'now()' } },
            { fn: 'filter', arguments: { fn: '(r) => r._field == "a"' } },
            { fn: 'filter', arguments: { fn: '(r) => r._time < 2022-01-01T00:00:00Z or r["a a a"] != 99' } },
            { fn: 'keep', arguments: { columns: '["_time", "_value"]' } },
            { fn: 'sort', arguments: { columns: '["_time"]' } },
        ],
    }];
    expect(generatePipelines(clauses)).toEqual(pipelines);
});

test('group by one column', () => {
    const clauses: Clauses = {
        select: {
            star: false,
            expressions: [],
        },
        from: { bucket: 'b' },
        groupBy: {
            star: false,
            columns: ['"user agent"'],
        },
    };

    const pipelines: Pipeline[] = [{
        stages: [
            { fn: 'from', arguments: { bucket: '"b"' } },
            { fn: 'group', arguments: { columns: '["user agent"]', mode: '"by"' } },
            { fn: 'keep', arguments: { columns: '["_time", "_value", "user agent"]' } },
            { fn: 'sort', arguments: { columns: '["_time"]' } },
        ],
    }];
    expect(generatePipelines(clauses)).toEqual(pipelines);
});

test('group by multiple columns', () => {
    const clauses: Clauses = {
        select: {
            star: false,
            expressions: [],
        },
        from: { bucket: 'b' },
        groupBy: {
            star: false,
            columns: ['"user agent"', '"host"'],
        },
    };

    const pipelines: Pipeline[] = [{
        stages: [
            { fn: 'from', arguments: { bucket: '"b"' } },
            { fn: 'group', arguments: { columns: '["user agent", "host"]', mode: '"by"' } },
            { fn: 'keep', arguments: { columns: '["_time", "_value", "user agent", "host"]' } },
            { fn: 'sort', arguments: { columns: '["_time"]' } },
        ],
    }];
    expect(generatePipelines(clauses)).toEqual(pipelines);
});

test('group by one column and aggregate', () => {
    const clauses: Clauses = {
        select: {
            star: false,
            expressions: [
                {
                    pattern: '#', fields: [], functions: [{
                        fn: 'mean', arguments: [
                            { pattern: '$', fields: ['requests'], functions: [] },
                        ],
                    }],
                },
            ],
        },
        from: { bucket: 'system' },
        groupBy: {
            star: false,
            columns: ['"instance"'],
        },
    };

    const pipelines: Pipeline[] = [{
        stages: [
            { fn: 'from', arguments: { bucket: '"system"' } },
            { fn: 'filter', arguments: { fn: '(r) => r._field == "requests"' } },
            { fn: 'group', arguments: { columns: '["instance"]', mode: '"by"' } },
            { fn: 'mean', arguments: {} },
            { fn: 'keep', arguments: { columns: '["_time", "_value", "instance"]' } },
            { fn: 'sort', arguments: { columns: '["_time"]' } },
        ],
    }];
    expect(generatePipelines(clauses)).toEqual(pipelines);
});

test('group by time', () => {
    const clauses: Clauses = {
        select: {
            star: false,
            expressions: [
                {
                    pattern: '#', fields: [], functions: [{
                        fn: 'mean', arguments: [
                            { pattern: '$', fields: ['a'], functions: [] },
                        ],
                    }],
                },
            ],
        },
        from: { bucket: 'b' },
        groupBy: {
            star: false,
            columns: [],
            timeInterval: '30s',
        },
    };

    const pipelines: Pipeline[] = [{
        stages: [
            { fn: 'from', arguments: { bucket: '"b"' } },
            { fn: 'filter', arguments: { fn: '(r) => r._field == "a"' } },
            { fn: 'aggregateWindow', arguments: { every: '30s', fn: 'mean' } },
            { fn: 'keep', arguments: { columns: '["_time", "_value"]' } },
            { fn: 'sort', arguments: { columns: '["_time"]' } },
        ],
    }];
    expect(generatePipelines(clauses)).toEqual(pipelines);
});

test('where and group by time and columns (no time aggregation should show up)', () => {
    const clauses: Clauses = {
        select: {
            star: false,
            expressions: [
                { pattern: '$', fields: ['a'], functions: [] },
            ],
        },
        from: { bucket: 'b' },
        where: {
            filters: { fields: ['host'], operator: '!~', value: '/^eu-[0-9]+/' },
            timeFilters: [{ fields: ['_time'], operator: '>', value: 'now()' }],
        },
        groupBy: {
            star: false,
            columns: ['"xxx"', '"host"', '"c"'],
            timeInterval: '1mo',
        },
    };

    const pipelines: Pipeline[] = [{
        stages: [
            { fn: 'from', arguments: { bucket: '"b"' } },
            { fn: 'range', arguments: { start: 'now()' } },
            { fn: 'filter', arguments: { fn: '(r) => r._field == "a"' } },
            { fn: 'filter', arguments: { fn: '(r) => r.host !~ /^eu-[0-9]+/' } },
            { fn: 'group', arguments: { columns: '["xxx", "host", "c"]', mode: '"by"' } },
            { fn: 'keep', arguments: { columns: '["_time", "_value", "xxx", "host", "c"]' } },
            { fn: 'sort', arguments: { columns: '["_time"]' } },
        ],
    }];
    expect(generatePipelines(clauses)).toEqual(pipelines);
});

test('fill value', () => {
    const clauses: Clauses = {
        select: {
            star: false,
            expressions: [],
        },
        from: { bucket: 'b' },
        fill: {
            usePrevious: false,
            value: '1.5',
        },
    };

    const pipelines: Pipeline[] = [{
        stages: [
            { fn: 'from', arguments: { bucket: '"b"' } },
            { fn: 'fill', arguments: { value: '1.5' } },
            { fn: 'keep', arguments: { columns: '["_time", "_value"]' } },
            { fn: 'sort', arguments: { columns: '["_time"]' } },
        ],
    }];
    expect(generatePipelines(clauses)).toEqual(pipelines);
});

test('fill previous', () => {
    const clauses: Clauses = {
        select: {
            star: false,
            expressions: [],
        },
        from: { bucket: 'b' },
        fill: {
            usePrevious: true,
            value: '',
        },
    };

    const pipelines: Pipeline[] = [{
        stages: [
            { fn: 'from', arguments: { bucket: '"b"' } },
            { fn: 'fill', arguments: { usePrevious: 'true' } },
            { fn: 'keep', arguments: { columns: '["_time", "_value"]' } },
            { fn: 'sort', arguments: { columns: '["_time"]' } },
        ],
    }];
    expect(generatePipelines(clauses)).toEqual(pipelines);
});

test('fill with no value', () => {
    const clauses: Clauses = {
        select: {
            star: false,
            expressions: [],
        },
        from: { bucket: 'b' },
        fill: {
            usePrevious: false,
            value: '',
        },
    };

    const pipelines: Pipeline[] = [{
        stages: [
            { fn: 'from', arguments: { bucket: '"b"' } },
            { fn: 'keep', arguments: { columns: '["_time", "_value"]' } },
            { fn: 'sort', arguments: { columns: '["_time"]' } },
        ],
    }];
    expect(generatePipelines(clauses)).toEqual(pipelines);
});

test('group and fill', () => {
    const clauses: Clauses = {
        select: {
            star: false,
            expressions: [
                { pattern: '$', fields: ['a'], functions: [] },
            ],
        },
        from: { bucket: 'b' },
        where: {
            timeFilters: [{ fields: ['_time'], operator: '>', value: 'now()' }],
        },
        groupBy: {
            star: false,
            columns: ['"host"'],
        },
        fill: {
            usePrevious: false,
            value: '12',
        },
    };

    const pipelines: Pipeline[] = [{
        stages: [
            { fn: 'from', arguments: { bucket: '"b"' } },
            { fn: 'range', arguments: { start: 'now()' } },
            { fn: 'filter', arguments: { fn: '(r) => r._field == "a"' } },
            { fn: 'group', arguments: { columns: '["host"]', mode: '"by"' } },
            { fn: 'fill', arguments: { value: '12' } },
            { fn: 'keep', arguments: { columns: '["_time", "_value", "host"]' } },
            { fn: 'sort', arguments: { columns: '["_time"]' } },
        ],
    }];
    expect(generatePipelines(clauses)).toEqual(pipelines);
});

test('one aggregation function', () => {
    const clauses: Clauses = {
        select: {
            star: false,
            expressions: [
                {
                    pattern: '#', fields: [], functions: [{
                        fn: 'top', arguments: [
                            { pattern: '$', fields: ['requests'], functions: [] },
                            { pattern: '20', fields: [], functions: [] },
                        ],
                    }],
                },
            ],
        },
        from: { bucket: 'system' },
    };

    const pipelines: Pipeline[] = [{
        stages: [
            { fn: 'from', arguments: { bucket: '"system"' } },
            { fn: 'filter', arguments: { fn: '(r) => r._field == "requests"' } },
            { fn: 'top', arguments: { n: '20' } },
            { fn: 'keep', arguments: { columns: '["_time", "_value"]' } },
            { fn: 'sort', arguments: { columns: '["_time"]' } },
        ],
    }];
    expect(generatePipelines(clauses)).toEqual(pipelines);
});

test('one aggregation function with time grouping', () => {
    const clauses: Clauses = {
        select: {
            star: false,
            expressions: [
                {
                    pattern: '#', fields: [], functions: [{
                        fn: 'mean', arguments: [
                            { pattern: '$', fields: ['"response time"'], functions: [] },
                        ],
                    }],
                },
            ],
        },
        from: { bucket: 'b' },
        groupBy: {
            star: false,
            columns: [],
            timeInterval: '30s',
        },
    };

    const pipelines: Pipeline[] = [{
        stages: [
            { fn: 'from', arguments: { bucket: '"b"' } },
            { fn: 'filter', arguments: { fn: '(r) => r._field == "response time"' } },
            { fn: 'aggregateWindow', arguments: { every: '30s', fn: 'mean' } },
            { fn: 'keep', arguments: { columns: '["_time", "_value"]' } },
            { fn: 'sort', arguments: { columns: '["_time"]' } },
        ],
    }];
    expect(generatePipelines(clauses)).toEqual(pipelines);
});

test('nested functions (no math)', () => {
    const clauses: Clauses = {
        select: {
            star: false,
            expressions: [
                {
                    pattern: '#', fields: [], functions: [{
                        fn: 'count', arguments: [
                            {
                                pattern: '#', fields: [], functions: [
                                    {
                                        fn: 'distinct', arguments: [
                                            { pattern: '$', fields: ['cpu_usage'], functions: [] },
                                        ],
                                    },
                                ],
                            },
                        ],
                    }],
                },
            ],
        },
        from: { bucket: 'system' },
    };

    const pipelines: Pipeline[] = [{
        stages: [
            { fn: 'from', arguments: { bucket: '"system"' } },
            { fn: 'filter', arguments: { fn: '(r) => r._field == "cpu_usage"' } },
            { fn: 'distinct', arguments: {} },
            { fn: 'count', arguments: {} },
            { fn: 'keep', arguments: { columns: '["_time", "_value"]' } },
            { fn: 'sort', arguments: { columns: '["_time"]' } },
        ],
    }];
    expect(generatePipelines(clauses)).toEqual(pipelines);
});

test('nested aggregation functions with time aggregation', () => {
    const clauses: Clauses = {
        select: {
            star: false,
            expressions: [
                {
                    pattern: '#', fields: [], functions: [{
                        fn: 'non_negative_derivative', arguments: [
                            {
                                pattern: '#', fields: [], functions: [
                                    {
                                        fn: 'last', arguments: [
                                            { pattern: '$', fields: ['requests'], functions: [] },
                                        ],
                                    },
                                ],
                            },
                            { pattern: '1s', fields: [], functions: [] },
                        ],
                    }],
                },
            ],
        },
        from: { bucket: 'system' },
        groupBy: {
            star: false,
            columns: ['"host"', '"user_agent"'],
            timeInterval: '10s',
        },
    };

    const pipelines: Pipeline[] = [{
        stages: [
            { fn: 'from', arguments: { bucket: '"system"' } },
            { fn: 'filter', arguments: { fn: '(r) => r._field == "requests"' } },
            { fn: 'group', arguments: { columns: '["host", "user_agent"]', mode: '"by"' } },
            { fn: 'aggregateWindow', arguments: { every: '10s', fn: 'last' } },
            { fn: 'derivative', arguments: { unit: '1s', nonNegative: 'true' } },
            { fn: 'keep', arguments: { columns: '["_time", "_value", "host", "user_agent"]' } },
            { fn: 'sort', arguments: { columns: '["_time"]' } },
        ],
    }];
    expect(generatePipelines(clauses)).toEqual(pipelines);
});

test('one field with math', () => {
    const clauses: Clauses = {
        select: {
            star: false,
            expressions: [
                {
                    pattern: '5 - ($ + 100) / 25.2', fields: ['a'], functions: [],
                },
            ],
        },
        from: { bucket: 'system' },
    };

    const pipelines: Pipeline[] = [{
        stages: [
            { fn: 'from', arguments: { bucket: '"system"' } },
            { fn: 'filter', arguments: { fn: '(r) => r._field == "a"' } },
            { fn: 'map', arguments: { fn: '(r) => ({ r with _value: 5 - (r._value + 100) / 25.2 })' } },
            { fn: 'keep', arguments: { columns: '["_time", "_value"]' } },
            { fn: 'sort', arguments: { columns: '["_time"]' } },
        ],
    }];
    expect(generatePipelines(clauses)).toEqual(pipelines);
});

test('two fields with math', () => {
    const clauses: Clauses = {
        select: {
            star: false,
            expressions: [
                {
                    pattern: '$ / $', fields: ['a', 'b'], functions: [],
                },
            ],
        },
        from: { bucket: 'system' },
    };

    const pipelines: Pipeline[] = [{
        stages: [
            { fn: 'from', arguments: { bucket: '"system"' } },
            { fn: 'filter', arguments: { fn: '(r) => r._field == "a" or r._field == "b"' } },
            { fn: 'pivot', arguments: { rowKey: '["_time"]', columnKey: '["_field"]', valueColumn: '"_value"' } },
            { fn: 'map', arguments: { fn: '(r) => ({ r with _value: r.a / r.b })' } },
            { fn: 'keep', arguments: { columns: '["_time", "_value"]' } },
            { fn: 'sort', arguments: { columns: '["_time"]' } },
        ],
    }];
    expect(generatePipelines(clauses)).toEqual(pipelines);
});

test('percentile and percentage calculation', () => {
    const clauses: Clauses = {
        select: {
            star: false,
            expressions: [
                {
                    pattern: '# * 100 / $', fields: ['"memory total"'], functions: [
                        {
                            fn: 'percentile', arguments: [
                                { pattern: '$ * 0.5', fields: ['memory_usage'], functions: [] },
                                { pattern: '97.5', fields: [], functions: [] },
                            ],
                        },
                    ],
                },
            ],
        },
        from: { bucket: 'system' },
        groupBy: {
            star: false,
            columns: ['"host"'],
            timeInterval: '10s',
        },
    };

    const pipelines: Pipeline[] = [{
        stages: [
            { fn: 'from', arguments: { bucket: '"system"' } },
            { fn: 'filter', arguments: { fn: '(r) => r._field == "memory total" or r._field == "memory_usage"' } },
            { fn: 'group', arguments: { columns: '["host"]', mode: '"by"' } },
            { fn: 'map', arguments: { fn: '(r) => ({ r with _value: r._value * 0.5 })' } },
            { fn: 'aggregateWindow', arguments: { every: '10s', fn: [{ fn: 'quantile', arguments: { q: '0.975' } }] } },
            { fn: 'pivot', arguments: { rowKey: '["_time"]', columnKey: '["_field"]', valueColumn: '"_value"' } },
            { fn: 'map', arguments: { fn: '(r) => ({ r with _value: r._value * 100 / r["memory total"] })' } },
            { fn: 'keep', arguments: { columns: '["_time", "_value", "host"]' } },
            { fn: 'sort', arguments: { columns: '["_time"]' } },
        ],
    }];
    expect(generatePipelines(clauses)).toEqual(pipelines);
});

test('math before first aggregation', () => {
    const clauses: Clauses = {
        select: {
            star: false,
            expressions: [
                {
                    pattern: '# / 100', fields: [], functions: [{
                        fn: 'integral', arguments: [
                            {
                                pattern: '# / 2 + ($ ^ $)', fields: ['a', 'b'], functions: [
                                    {
                                        fn: 'sum', arguments: [
                                            {
                                                pattern: '($ - 10) / 29 + ($ | 3)',
                                                fields: ['requests', '"data center"'],
                                                functions: [],
                                            },
                                        ],
                                    },
                                ],
                            },
                            { pattern: '1.5m', fields: [], functions: [] },
                        ],
                    }],
                },
            ],
        },
        from: { bucket: 'system' },
        groupBy: {
            star: false,
            columns: ['"host"'],
            timeInterval: '5.5h',
        },
    };

    const pipelines: Pipeline[] = [{
        stages: [
            { fn: 'from', arguments: { bucket: '"system"' } },
            { fn: 'filter', arguments: { fn: '(r) => r._field == "a" or r._field == "b" or r._field == "requests" or r._field == "data center"' } },
            { fn: 'group', arguments: { columns: '["host"]', mode: '"by"' } },
            { fn: 'pivot', arguments: { rowKey: '["_time"]', columnKey: '["_field"]', valueColumn: '"_value"' } },
            { fn: 'map', arguments: { fn: '(r) => ({ r with _value: (r.requests - 10) / 29 + (r["data center"] | 3) })' } },
            { fn: 'aggregateWindow', arguments: { every: '5.5h', fn: 'sum' } },
            { fn: 'map', arguments: { fn: '(r) => ({ r with _value: r._value / 2 + (r.a ^ r.b) })' } },
            { fn: 'integral', arguments: { unit: '1.5m' } },
            { fn: 'map', arguments: { fn: '(r) => ({ r with _value: r._value / 100 })' } },
            { fn: 'keep', arguments: { columns: '["_time", "_value", "host"]' } },
            { fn: 'sort', arguments: { columns: '["_time"]' } },
        ],
    }];
    expect(generatePipelines(clauses)).toEqual(pipelines);
});

test('different aggregates for same field', () => {
    const clauses: Clauses = {
        select: {
            star: false,
            expressions: [
                {
                    pattern: '#', fields: [], functions: [{
                        fn: 'mean', arguments: [
                            { pattern: '$', fields: ['requests'], functions: [] },
                        ],
                    }],
                },
                {
                    pattern: '#', fields: [], functions: [{
                        fn: 'max', arguments: [
                            { pattern: '$', fields: ['requests'], functions: [] },
                        ],
                    }],
                },
            ],
        },
        from: { bucket: 'system' },
        groupBy: {
            star: false,
            columns: ['"instance"'],
        },
    };

    const pipeline: Pipeline[] = [
        {
            stages: [
                { fn: 'from', arguments: { bucket: '"system"' } },
                { fn: 'filter', arguments: { fn: '(r) => r._field == "requests"' } },
                { fn: 'group', arguments: { columns: '["instance"]', mode: '"by"' } },
            ],
            outputVariableName: 'data',
        },
        {
            stages: [
                { fn: 'mean', arguments: {} },
                { fn: 'set', arguments: { key: '"_field"', value: '"data_field_1"' } },
            ],
            outputVariableName: 'data_field_1',
            inputVariableName: 'data',
        },
        {
            stages: [
                { fn: 'max', arguments: {} },
                { fn: 'set', arguments: { key: '"_field"', value: '"data_field_2"' } },
            ],
            outputVariableName: 'data_field_2',
            inputVariableName: 'data',
        },
        {
            stages: [
                { fn: 'union', arguments: { tables: '[data_field_1, data_field_2]' } },
                { fn: 'pivot', arguments: { rowKey: '["_time"]', columnKey: '["_field"]', valueColumn: '"_value"' } },
                { fn: 'keep', arguments: { columns: '["_time", "instance", "data_field_1", "data_field_2"]' } },
                { fn: 'sort', arguments: { columns: '["_time"]' } },
            ],
        },
    ];

    expect(generatePipelines(clauses)).toEqual(pipeline);
});

test('different aggregates for different fields', () => {
    const clauses: Clauses = {
        select: {
            star: false,
            expressions: [
                {
                    pattern: '#', fields: [], functions: [{
                        fn: 'mean', arguments: [
                            { pattern: '$ + $', fields: ['a', 'b'], functions: [] },
                        ],
                    }],
                },
                {
                    pattern: '#', fields: [], functions: [{
                        fn: 'max', arguments: [
                            { pattern: '$', fields: ['b'], functions: [] },
                        ],
                    }],
                },
            ],
        },
        from: { bucket: 'system' },
        groupBy: {
            star: false,
            columns: ['"instance"'],
        },
    };

    const pipeline: Pipeline[] = [
        {
            stages: [
                { fn: 'from', arguments: { bucket: '"system"' } },
                { fn: 'filter', arguments: { fn: '(r) => r._field == "a" or r._field == "b"' } },
                { fn: 'group', arguments: { columns: '["instance"]', mode: '"by"' } },
            ],
            outputVariableName: 'data',
        },
        {
            stages: [
                { fn: 'pivot', arguments: { rowKey: '["_time"]', columnKey: '["_field"]', valueColumn: '"_value"' } },
                { fn: 'map', arguments: { fn: '(r) => ({ r with _value: r.a + r.b })' } },
                { fn: 'mean', arguments: {} },
                { fn: 'set', arguments: { key: '"_field"', value: '"data_field_1"' } },
            ],
            outputVariableName: 'data_field_1',
            inputVariableName: 'data',
        },
        {
            stages: [
                { fn: 'filter', arguments: { fn: '(r) => r._field == "b"' } },
                { fn: 'max', arguments: {} },
                { fn: 'set', arguments: { key: '"_field"', value: '"data_field_2"' } },
            ],
            outputVariableName: 'data_field_2',
            inputVariableName: 'data',
        },
        {
            stages: [
                { fn: 'union', arguments: { tables: '[data_field_1, data_field_2]' } },
                { fn: 'pivot', arguments: { rowKey: '["_time"]', columnKey: '["_field"]', valueColumn: '"_value"' } },
                { fn: 'keep', arguments: { columns: '["_time", "instance", "data_field_1", "data_field_2"]' } },
                { fn: 'sort', arguments: { columns: '["_time"]' } },
            ],
        },
    ];

    expect(generatePipelines(clauses)).toEqual(pipeline);
});

test('different aggregates for different fields in one expression', () => {
    const clauses: Clauses = {
        select: {
            star: false,
            expressions: [
                {
                    pattern: '# * 100 / #', fields: [], functions: [
                        {
                            fn: 'mean', arguments: [
                                { pattern: '$ + $', fields: ['memory_swap', 'memory_used'], functions: [] },
                            ],
                        },
                        {
                            fn: 'last', arguments: [
                                { pattern: '$', fields: ['memory_total'], functions: [] },
                            ],
                        },
                    ],
                },
            ],
        },
        from: { bucket: 'system' },
        groupBy: {
            star: false,
            columns: ['"instance"'],
        },
    };

    const pipeline: Pipeline[] = [
        {
            stages: [
                { fn: 'from', arguments: { bucket: '"system"' } },
                { fn: 'filter', arguments: { fn: '(r) => r._field == "memory_swap" or r._field == "memory_used" or r._field == "memory_total"' } },
                { fn: 'group', arguments: { columns: '["instance"]', mode: '"by"' } },
            ],
            outputVariableName: 'data',
        },
        {
            stages: [
                { fn: 'filter', arguments: { fn: '(r) => r._field == "memory_swap" or r._field == "memory_used"' } },
                { fn: 'pivot', arguments: { rowKey: '["_time"]', columnKey: '["_field"]', valueColumn: '"_value"' } },
                { fn: 'map', arguments: { fn: '(r) => ({ r with _value: r.memory_swap + r.memory_used })' } },
                { fn: 'mean', arguments: {} },
                { fn: 'set', arguments: { key: '"_field"', value: '"data_field_1"' } },
            ],
            outputVariableName: 'data_field_1',
            inputVariableName: 'data',
        },
        {
            stages: [
                { fn: 'filter', arguments: { fn: '(r) => r._field == "memory_total"' } },
                { fn: 'last', arguments: {} },
                { fn: 'set', arguments: { key: '"_field"', value: '"data_field_2"' } },
            ],
            outputVariableName: 'data_field_2',
            inputVariableName: 'data',
        },
        {
            stages: [
                { fn: 'union', arguments: { tables: '[data_field_1, data_field_2]' } },
                { fn: 'pivot', arguments: { rowKey: '["_time"]', columnKey: '["_field"]', valueColumn: '"_value"' } },
                { fn: 'map', arguments: { fn: '(r) => ({ r with _value: r.data_field_1 * 100 / r.data_field_2 })' } },
                { fn: 'keep', arguments: { columns: '["_time", "_value", "instance"]' } },
                { fn: 'sort', arguments: { columns: '["_time"]' } },
            ],
        },
    ];

    expect(generatePipelines(clauses)).toEqual(pipeline);
});

test('different nested aggregates for different fields in one expression', () => {
    const clauses: Clauses = {
        select: {
            star: false,
            expressions: [
                {
                    pattern: '# * 100 / #', fields: [], functions: [
                        {
                            fn: 'mean', arguments: [
                                {
                                    pattern: '(3 + #) / #', fields: [], functions: [
                                        {
                                            fn: 'distinct', arguments: [
                                                {
                                                    pattern: '1 / ($ + $)', fields: ['a', 'b'], functions: [],
                                                },
                                            ],
                                        },
                                        {
                                            fn: 'count', arguments: [
                                                {
                                                    pattern: '$', fields: ['a'], functions: [],
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            fn: 'derivative', arguments: [
                                { pattern: '$', fields: ['d'], functions: [] },
                                { pattern: '1s', fields: [], functions: [] },
                            ],
                        },
                    ],
                },
            ],
        },
        from: { bucket: 'system' },
        groupBy: {
            star: false,
            columns: ['"instance"'],
        },
    };

    const pipeline: Pipeline[] = [
        {
            stages: [
                { fn: 'from', arguments: { bucket: '"system"' } },
                { fn: 'filter', arguments: { fn: '(r) => r._field == "a" or r._field == "b" or r._field == "d"' } },
                { fn: 'group', arguments: { columns: '["instance"]', mode: '"by"' } },
            ],
            outputVariableName: 'data',
        },
        {
            stages: [
                { fn: 'filter', arguments: { fn: '(r) => r._field == "a" or r._field == "b"' } },
                { fn: 'pivot', arguments: { rowKey: '["_time"]', columnKey: '["_field"]', valueColumn: '"_value"' } },
                { fn: 'map', arguments: { fn: '(r) => ({ r with _value: 1 / (r.a + r.b) })' } },
                { fn: 'distinct', arguments: {} },
                { fn: 'set', arguments: { key: '"_field"', value: '"data_field_1"' } },
            ],
            outputVariableName: 'data_field_1',
            inputVariableName: 'data',
        },
        {
            stages: [
                { fn: 'filter', arguments: { fn: '(r) => r._field == "a"' } },
                { fn: 'count', arguments: {} },
                { fn: 'set', arguments: { key: '"_field"', value: '"data_field_2"' } },
            ],
            outputVariableName: 'data_field_2',
            inputVariableName: 'data',
        },
        {
            stages: [
                { fn: 'union', arguments: { tables: '[data_field_1, data_field_2]' } },
                { fn: 'pivot', arguments: { rowKey: '["_time"]', columnKey: '["_field"]', valueColumn: '"_value"' } },
                { fn: 'map', arguments: { fn: '(r) => ({ r with _value: (3 + r.data_field_1) / r.data_field_2 })' } },
                { fn: 'mean', arguments: {} },
                { fn: 'set', arguments: { key: '"_field"', value: '"data_field_3"' } },
            ],
            outputVariableName: 'data_field_3',
        },
        {
            stages: [
                { fn: 'filter', arguments: { fn: '(r) => r._field == "d"' } },
                { fn: 'derivative', arguments: { unit: '1s', nonNegative: 'false' } },
                { fn: 'set', arguments: { key: '"_field"', value: '"data_field_4"' } },
            ],
            outputVariableName: 'data_field_4',
            inputVariableName: 'data',
        },
        {
            stages: [
                { fn: 'union', arguments: { tables: '[data_field_3, data_field_4]' } },
                { fn: 'pivot', arguments: { rowKey: '["_time"]', columnKey: '["_field"]', valueColumn: '"_value"' } },
                { fn: 'map', arguments: { fn: '(r) => ({ r with _value: r.data_field_3 * 100 / r.data_field_4 })' } },
                { fn: 'keep', arguments: { columns: '["_time", "_value", "instance"]' } },
                { fn: 'sort', arguments: { columns: '["_time"]' } },
            ],
        },
    ];

    expect(generatePipelines(clauses)).toEqual(pipeline);
});
