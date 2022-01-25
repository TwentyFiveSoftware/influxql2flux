import { generatePipeline } from './generatePipeline';
import type { Clauses } from '../clauses/types';

test('empty', () => {
    const clauses: Clauses = {};
    const pipeline = generatePipeline(clauses);
    expect(pipeline.stages).toEqual([]);
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

    expect(generatePipeline(clauses)).toEqual({
        from: { bucket: 'system' },
        filters: [{ pattern: '$ == "ram_usage"', fields: ['_field'] }],
        stages: [],
    });
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
        },
    };

    expect(generatePipeline(clauses)).toEqual({
        from: { bucket: 'system', retention: 'autogen' },
        filters: [
            { pattern: '$ == "cpu" or $ == "ram"', fields: ['_field', '_field'] },
            { pattern: '$ =~ /$host/', fields: ['host'] },
            { pattern: '$ + $ != "m-1"', fields: ['"data center"', 'nr'] },
        ],
        stages: [],
    });
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
        },
    };

    expect(generatePipeline(clauses)).toEqual({
        from: { bucket: 'system', retention: 'autogen' },
        filters: [
            { pattern: '$ == "cpu"', fields: ['_field'] },
            { pattern: '$ > -3.5', fields: ['a'] },
            {
                pattern: '($ == 3 and $ == "xxx") or ($ - 5) * 3 < 100 or $ != "frontend"',
                fields: ['b', 'c', 'd', 'e'],
            },
        ],
        stages: [],
    });
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
            filters: { fields: ['time'], operator: '>=', value: 'now() - 7d' },
        },
    };

    expect(generatePipeline(clauses)).toEqual({
        from: { bucket: 'system' },
        range: { start: '-7d' },
        filters: [
            { pattern: '$ == "cpu"', fields: ['_measurement'] },
            { pattern: '$ == "usage"', fields: ['_field'] },
        ],
        stages: [],
    });
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
            filters: { fields: ['time'], operator: '<', value: '2022-01-01T00:00:00Z' },
        },
    };

    expect(generatePipeline(clauses)).toEqual({
        from: { bucket: 'system' },
        range: { stop: '2022-01-01T00:00:00Z' },
        filters: [
            { pattern: '$ == "cpu"', fields: ['_measurement'] },
            { pattern: '$ == "usage"', fields: ['_field'] },
        ],
        stages: [],
    });
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
                type: 'and', variables: [
                    { fields: ['time'], operator: '>', value: 'now()' },
                    {
                        type: 'or', variables: [
                            { fields: ['time'], operator: '<', value: '2022-01-01T00:00:00Z' },
                            { fields: ['"a a a"'], operator: '!=', value: '99' },
                        ],
                    },
                ],
            },
        },
    };

    expect(generatePipeline(clauses)).toEqual({
        from: { bucket: 'b' },
        range: { start: 'now()' },
        filters: [
            { pattern: '$ == "a"', fields: ['_field'] },
            { pattern: '$ < 2022-01-01T00:00:00Z or $ != 99', fields: ['_time', '"a a a"'] },
        ],
        stages: [],
    });
});
