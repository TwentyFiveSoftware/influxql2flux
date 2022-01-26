import { generatePipeline } from './generatePipeline';
import type { Clauses } from '../clauses/types';
import type { PipelineStage } from './types';

test('empty', () => {
    expect(generatePipeline({}).stages).toEqual([]);
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

    const stages: PipelineStage[] = [
        { fn: 'from', arguments: { bucket: '"system"' } },
        { fn: 'filter', arguments: { fn: '(r) => r._field == "ram_usage"' } },
    ];

    expect(generatePipeline(clauses).stages).toEqual(stages);
});

test('basic filter test', () => {
    const clauses: Clauses = {
        select: {
            star: false,
            expressions: [
                { pattern: '$', fields: ['cpu'], functions: [] },
                { pattern: '$', fields: ['ram'], functions: [] },
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

    const stages: PipelineStage[] = [
        { fn: 'from', arguments: { bucket: '"system/autogen"' } },
        { fn: 'filter', arguments: { fn: '(r) => r._field == "cpu" or r._field == "ram"' } },
        { fn: 'filter', arguments: { fn: '(r) => r.host =~ /$host/' } },
        { fn: 'filter', arguments: { fn: '(r) => r["data center"] + r.nr != "m-1"' } },
    ];

    expect(generatePipeline(clauses).stages).toEqual(stages);
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

    const stages: PipelineStage[] = [
        { fn: 'from', arguments: { bucket: '"system/autogen"' } },
        { fn: 'filter', arguments: { fn: '(r) => r._field == "cpu"' } },
        { fn: 'filter', arguments: { fn: '(r) => r.a > -3.5' } },
        { fn: 'filter', arguments: { fn: '(r) => (r.b == 3 and r.c == "xxx") or (r.d - 5) * 3 < 100 or r.e != "frontend"' } },
    ];

    expect(generatePipeline(clauses).stages).toEqual(stages);
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

    const stages: PipelineStage[] = [
        { fn: 'from', arguments: { bucket: '"system"' } },
        { fn: 'range', arguments: { start: '-7d' } },
        { fn: 'filter', arguments: { fn: '(r) => r._measurement == "cpu"' } },
        { fn: 'filter', arguments: { fn: '(r) => r._field == "usage"' } },
    ];

    expect(generatePipeline(clauses).stages).toEqual(stages);
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

    const stages: PipelineStage[] = [
        { fn: 'from', arguments: { bucket: '"system"' } },
        { fn: 'range', arguments: { stop: '2022-01-01T00:00:00Z' } },
        { fn: 'filter', arguments: { fn: '(r) => r._measurement == "cpu"' } },
        { fn: 'filter', arguments: { fn: '(r) => r._field == "usage"' } },
    ];

    expect(generatePipeline(clauses).stages).toEqual(stages);
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

    const stages: PipelineStage[] = [
        { fn: 'from', arguments: { bucket: '"b"' } },
        { fn: 'range', arguments: { start: 'now()' } },
        { fn: 'filter', arguments: { fn: '(r) => r._field == "a"' } },
        { fn: 'filter', arguments: { fn: '(r) => r._time < 2022-01-01T00:00:00Z or r["a a a"] != 99' } },
    ];

    expect(generatePipeline(clauses).stages).toEqual(stages);
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

    const stages: PipelineStage[] = [
        { fn: 'from', arguments: { bucket: '"b"' } },
        { fn: 'group', arguments: { columns: '["user agent"]', mode: '"by"' } },
    ];

    expect(generatePipeline(clauses).stages).toEqual(stages);
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

    const stages: PipelineStage[] = [
        { fn: 'from', arguments: { bucket: '"b"' } },
        { fn: 'group', arguments: { columns: '["user agent", "host"]', mode: '"by"' } },
    ];

    expect(generatePipeline(clauses).stages).toEqual(stages);
});

test('group by time', () => {
    const clauses: Clauses = {
        select: {
            star: false,
            expressions: [],
        },
        from: { bucket: 'b' },
        groupBy: {
            star: false,
            columns: [],
            timeInterval: '30s',
        },
    };

    const stages: PipelineStage[] = [
        { fn: 'from', arguments: { bucket: '"b"' } },
        { fn: 'aggregateWindow', arguments: { every: '30s' } },
    ];

    expect(generatePipeline(clauses).stages).toEqual(stages);
});

test('where and group by time and columns', () => {
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

    const stages: PipelineStage[] = [
        { fn: 'from', arguments: { bucket: '"b"' } },
        { fn: 'range', arguments: { start: 'now()' } },
        { fn: 'filter', arguments: { fn: '(r) => r._field == "a"' } },
        { fn: 'filter', arguments: { fn: '(r) => r.host !~ /^eu-[0-9]+/' } },
        { fn: 'aggregateWindow', arguments: { every: '1mo' } },
        { fn: 'group', arguments: { columns: '["xxx", "host", "c"]', mode: '"by"' } },
    ];

    expect(generatePipeline(clauses).stages).toEqual(stages);
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

    const stages: PipelineStage[] = [
        { fn: 'from', arguments: { bucket: '"b"' } },
        { fn: 'fill', arguments: { value: '1.5' } },
    ];

    expect(generatePipeline(clauses).stages).toEqual(stages);
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

    const stages: PipelineStage[] = [
        { fn: 'from', arguments: { bucket: '"b"' } },
        { fn: 'fill', arguments: { usePrevious: 'true' } },
    ];

    expect(generatePipeline(clauses).stages).toEqual(stages);
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

    const stages: PipelineStage[] = [
        { fn: 'from', arguments: { bucket: '"b"' } },
    ];

    expect(generatePipeline(clauses).stages).toEqual(stages);
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

    const stages: PipelineStage[] = [
        { fn: 'from', arguments: { bucket: '"b"' } },
        { fn: 'range', arguments: { start: 'now()' } },
        { fn: 'filter', arguments: { fn: '(r) => r._field == "a"' } },
        { fn: 'group', arguments: { columns: '["host"]', mode: '"by"' } },
        { fn: 'fill', arguments: { value: '12' } },
    ];

    expect(generatePipeline(clauses).stages).toEqual(stages);
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

    const stages: PipelineStage[] = [
        { fn: 'from', arguments: { bucket: '"system"' } },
        { fn: 'filter', arguments: { fn: '(r) => r._field == "requests"' } },
        { fn: 'top', arguments: { n: '20' } },
    ];

    expect(generatePipeline(clauses).stages).toEqual(stages);
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

    const stages: PipelineStage[] = [
        { fn: 'from', arguments: { bucket: '"b"' } },
        { fn: 'filter', arguments: { fn: '(r) => r._field == "response time"' } },
        { fn: 'aggregateWindow', arguments: { every: '30s', fn: 'mean' } },
    ];
    expect(generatePipeline(clauses).stages).toEqual(stages);
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

    const stages: PipelineStage[] = [
        { fn: 'from', arguments: { bucket: '"system"' } },
        { fn: 'filter', arguments: { fn: '(r) => r._field == "cpu_usage"' } },
        { fn: 'distinct', arguments: {} },
        { fn: 'count', arguments: {} },
    ];
    expect(generatePipeline(clauses).stages).toEqual(stages);
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

    const stages: PipelineStage[] = [
        { fn: 'from', arguments: { bucket: '"system"' } },
        { fn: 'filter', arguments: { fn: '(r) => r._field == "requests"' } },
        { fn: 'aggregateWindow', arguments: { every: '10s', fn: 'last' } },
        { fn: 'derivative', arguments: { unit: '1s', nonNegative: 'true' } },
        { fn: 'group', arguments: { columns: '["host", "user_agent"]', mode: '"by"' } },
    ];
    expect(generatePipeline(clauses).stages).toEqual(stages);
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

    const stages: PipelineStage[] = [
        { fn: 'from', arguments: { bucket: '"system"' } },
        { fn: 'filter', arguments: { fn: '(r) => r._field == "a"' } },
        { fn: 'map', arguments: { fn: '(r) => ({ r with _value: 5 - (r._value + 100) / 25.2 })' } },
    ];
    expect(generatePipeline(clauses).stages).toEqual(stages);
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

    const stages: PipelineStage[] = [
        { fn: 'from', arguments: { bucket: '"system"' } },
        { fn: 'filter', arguments: { fn: '(r) => r._field == "a" or r._field == "b"' } },
        { fn: 'pivot', arguments: { rowKey: '["_time"]', columnKey: '["_field"]', valueColumn: '"_value"' } },
        { fn: 'map', arguments: { fn: '(r) => ({ r with _value: r.a / r.b })' } },
    ];
    expect(generatePipeline(clauses).stages).toEqual(stages);
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

    const stages: PipelineStage[] = [
        { fn: 'from', arguments: { bucket: '"system"' } },
        { fn: 'filter', arguments: { fn: '(r) => r._field == "memory total" or r._field == "memory_usage"' } },
        { fn: 'map', arguments: { fn: '(r) => ({ r with _value: r._value * 0.5 })' } },
        { fn: 'aggregateWindow', arguments: { every: '10s', fn: [{ fn: 'quantile', arguments: { q: '0.975' } }] } },
        { fn: 'duplicate', arguments: { column: '_value', as: '__temp' } },
        { fn: 'pivot', arguments: { rowKey: '["_time"]', columnKey: '["_field"]', valueColumn: '"_value"' } },
        { fn: 'map', arguments: { fn: '(r) => ({ r with _value: r.__temp * 100 / r["memory total"] })' } },
        { fn: 'drop', arguments: { columns: '["__temp"]' } },
        { fn: 'group', arguments: { columns: '["host"]', mode: '"by"' } },
    ];
    expect(generatePipeline(clauses).stages).toEqual(stages);
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

    const stages: PipelineStage[] = [
        { fn: 'from', arguments: { bucket: '"system"' } },
        { fn: 'filter', arguments: { fn: '(r) => r._field == "a" or r._field == "b" or r._field == "requests" or r._field == "data center"' } },
        { fn: 'pivot', arguments: { rowKey: '["_time"]', columnKey: '["_field"]', valueColumn: '"_value"' } },
        { fn: 'map', arguments: { fn: '(r) => ({ r with _value: (r.requests - 10) / 29 + (r["data center"] | 3) })' } },
        { fn: 'aggregateWindow', arguments: { every: '5.5h', fn: 'sum' } },
        { fn: 'duplicate', arguments: { column: '_value', as: '__temp' } },
        { fn: 'pivot', arguments: { rowKey: '["_time"]', columnKey: '["_field"]', valueColumn: '"_value"' } },
        { fn: 'map', arguments: { fn: '(r) => ({ r with _value: r.__temp / 2 + (r.a ^ r.b) })' } },
        { fn: 'integral', arguments: { unit: '1.5m' } },
        { fn: 'map', arguments: { fn: '(r) => ({ r with _value: r._value / 100 })' } },
        { fn: 'drop', arguments: { columns: '["__temp"]' } },
        { fn: 'group', arguments: { columns: '["host"]', mode: '"by"' } },
    ];
    expect(generatePipeline(clauses).stages).toEqual(stages);
});
