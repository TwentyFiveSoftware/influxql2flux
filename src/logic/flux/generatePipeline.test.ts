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
                { pattern: '$', fields: ['"ram_usage"'], functions: [] },
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
                { pattern: '$', fields: ['"cpu"'], functions: [] },
                { pattern: '$', fields: ['"ram"'], functions: [] },
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
                { pattern: '$', fields: ['"cpu"'], functions: [] },
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
                { pattern: '$', fields: ['"usage"'], functions: [] },
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
                { pattern: '$', fields: ['"usage"'], functions: [] },
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
                { pattern: '$', fields: ['"a"'], functions: [] },
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
