import { Expression, transpileSelectClause } from './transpileSelectClause';

test('empty', () => {
    const selectClause = transpileSelectClause(``);
    expect(selectClause.star).toBe(true);
    expect(selectClause.expressions).toEqual([]);
});

test('star', () => {
    const selectClause = transpileSelectClause(`*`);
    expect(selectClause.star).toBe(true);
    expect(selectClause.expressions).toEqual([]);
});

test('one field', () => {
    const selectClause = transpileSelectClause(`"total_memory"`);
    const expressions: Expression[] = [
        { pattern: '$', fields: ['"total_memory"'], functions: [] },
    ];
    expect(selectClause.star).toBe(false);
    expect(selectClause.expressions).toEqual(expressions);
});

test('two fields', () => {
    const selectClause = transpileSelectClause(`"total_memory", 'cpu usage'`);
    const expressions: Expression[] = [
        { pattern: '$', fields: ['"total_memory"'], functions: [] },
        { pattern: '$', fields: ['"cpu usage"'], functions: [] },
    ];
    expect(selectClause.star).toBe(false);
    expect(selectClause.expressions).toEqual(expressions);
});

test('three fields', () => {
    const selectClause = transpileSelectClause(`"total_memory", disk, 'cpu usage'`);
    const expressions: Expression[] = [
        { pattern: '$', fields: ['"total_memory"'], functions: [] },
        { pattern: '$', fields: ['"disk"'], functions: [] },
        { pattern: '$', fields: ['"cpu usage"'], functions: [] },
    ];
    expect(selectClause.star).toBe(false);
    expect(selectClause.expressions).toEqual(expressions);
});

test('bottom', () => {
    const selectClause = transpileSelectClause(`bottom("water level", 7)`);
    const expressions: Expression[] = [
        {
            pattern: '#', fields: [], functions: [{
                fn: 'bottom', arguments: [
                    { pattern: '$', fields: ['"water level"'], functions: [] },
                    { pattern: '7', fields: [], functions: [] },
                ],
            }],
        },
    ];
    expect(selectClause.star).toBe(false);
    expect(selectClause.expressions).toEqual(expressions);
});

test('top', () => {
    const selectClause = transpileSelectClause(`max("request" ,  20  )`);
    const expressions: Expression[] = [
        {
            pattern: '#', fields: [], functions: [{
                fn: 'max', arguments: [
                    { pattern: '$', fields: ['"request"'], functions: [] },
                    { pattern: '20', fields: [], functions: [] },
                ],
            }],
        },
    ];
    expect(selectClause.star).toBe(false);
    expect(selectClause.expressions).toEqual(expressions);
});

test('count + distinct', () => {
    const selectClause = transpileSelectClause(`count(distinct(cpu_usage))`);
    const expressions: Expression[] = [
        {
            pattern: '#', fields: [], functions: [{
                fn: 'count', arguments: [
                    {
                        pattern: '#', fields: [], functions: [
                            {
                                fn: 'distinct', arguments: [
                                    { pattern: '$', fields: ['"cpu_usage"'], functions: [] },
                                ],
                            },
                        ],
                    },
                ],
            }],
        },
    ];
    expect(selectClause.star).toBe(false);
    expect(selectClause.expressions).toEqual(expressions);
});

test('percentile (90)', () => {
    const selectClause = transpileSelectClause(`percentile("cpu_usage", 90)`);
    const expressions: Expression[] = [
        {
            pattern: '#', fields: [], functions: [{
                fn: 'percentile', arguments: [
                    { pattern: '$', fields: ['"cpu_usage"'], functions: [] },
                    { pattern: '90', fields: [], functions: [] },
                ],
            }],
        },
    ];
    expect(selectClause.star).toBe(false);
    expect(selectClause.expressions).toEqual(expressions);
});

test('percentile (99.9)', () => {
    const selectClause = transpileSelectClause(` percentile(  "response_time"  ,  99.9)`);
    const expressions: Expression[] = [
        {
            pattern: '#', fields: [], functions: [{
                fn: 'percentile', arguments: [
                    { pattern: '$', fields: ['"response_time"'], functions: [] },
                    { pattern: '99.9', fields: [], functions: [] },
                ],
            }],
        },
    ];
    expect(selectClause.star).toBe(false);
    expect(selectClause.expressions).toEqual(expressions);
});


test.each([
    'count', 'distinct', 'integral', 'mean', 'median', 'mode', 'spread',
])('basic aggregation functions (%s)', (fn: string) => {
    const selectClause = transpileSelectClause(`${fn}("field")`);
    const expressions: Expression[] = [
        {
            pattern: '#', fields: [], functions: [{
                fn: fn, arguments: [{ pattern: '$', fields: ['"field"'], functions: [] }],
            }],
        },
    ];
    expect(selectClause.star).toBe(false);
    expect(selectClause.expressions).toEqual(expressions);
});

test.each([
    'first', 'last', 'max', 'min', 'sample',
])('basic selector functions (%s)', (fn: string) => {
    const selectClause = transpileSelectClause(`${fn}("field")`);
    const expressions: Expression[] = [
        {
            pattern: '#', fields: [], functions: [{
                fn: fn, arguments: [{ pattern: '$', fields: ['"field"'], functions: [] }],
            }],
        },
    ];
    expect(selectClause.star).toBe(false);
    expect(selectClause.expressions).toEqual(expressions);
});

test.each([
    'abs', 'acos', 'asin', 'atan', 'ceil', 'cos', 'cumulative_sum', 'derivative',
    'non_negative_derivative', 'difference', 'non_negative_difference', 'elapsed', 'exp', 'floor',
    'ln', 'log2', 'log10', 'round', 'sin', 'sqrt', 'tan',
])('basic transform functions (%s)', (fn: string) => {
    const selectClause = transpileSelectClause(`${fn}("field")`);
    const expressions: Expression[] = [
        {
            pattern: '#', fields: [], functions: [{
                fn: fn, arguments: [{ pattern: '$', fields: ['"field"'], functions: [] }],
            }],
        },
    ];
    expect(selectClause.star).toBe(false);
    expect(selectClause.expressions).toEqual(expressions);
});

test.each([
    'log', 'moving_average', 'pow',
])('advanced transform functions (%s)', (fn: string) => {
    const selectClause = transpileSelectClause(`${fn}("field", 5)`);
    const expressions: Expression[] = [
        {
            pattern: '#', fields: [], functions: [{
                fn: fn, arguments: [
                    { pattern: '$', fields: ['"field"'], functions: [] },
                    { pattern: '5', fields: [], functions: [] },
                ],
            }],
        },
    ];
    expect(selectClause.star).toBe(false);
    expect(selectClause.expressions).toEqual(expressions);
});

test('transform: atan2', () => {
    const selectClause = transpileSelectClause(`atan2("altitude", "distance")`);
    const expressions: Expression[] = [
        {
            pattern: '#', fields: [], functions: [{
                fn: 'atan2', arguments: [
                    { pattern: '$', fields: ['"altitude"'], functions: [] },
                    { pattern: '$', fields: ['"distance"'], functions: [] },
                ],
            }],
        },
    ];
    expect(selectClause.star).toBe(false);
    expect(selectClause.expressions).toEqual(expressions);
});

test('transform: derivative', () => {
    const selectClause = transpileSelectClause(`derivative("field", 1.5m)`);
    const expressions: Expression[] = [
        {
            pattern: '#', fields: [], functions: [{
                fn: 'derivative', arguments: [
                    { pattern: '$', fields: ['"field"'], functions: [] },
                    { pattern: '1.5m', fields: [], functions: [] },
                ],
            }],
        },
    ];
    expect(selectClause.star).toBe(false);
    expect(selectClause.expressions).toEqual(expressions);
});

test('transform: non_negative_derivative', () => {
    const selectClause = transpileSelectClause(`non_negative_derivative("field", 2s)`);
    const expressions: Expression[] = [
        {
            pattern: '#', fields: [], functions: [{
                fn: 'non_negative_derivative', arguments: [
                    { pattern: '$', fields: ['"field"'], functions: [] },
                    { pattern: '2s', fields: [], functions: [] },
                ],
            }],
        },
    ];
    expect(selectClause.star).toBe(false);
    expect(selectClause.expressions).toEqual(expressions);
});

test('math: 1', () => {
    const selectClause = transpileSelectClause(`((  (("A" * "B"))))`);
    const expressions: Expression[] = [{ pattern: '$ * $', fields: ['"A"', '"B"'], functions: [] }];
    expect(selectClause.star).toBe(false);
    expect(selectClause.expressions).toEqual(expressions);
});

test('math: 2', () => {
    const selectClause = transpileSelectClause(`C - 3 + "A" % ("B" + 1)`);
    const expressions: Expression[] = [{ pattern: '$ - 3 + $ % ($ + 1)', fields: ['"C"', '"A"', '"B"'], functions: [] }];
    expect(selectClause.star).toBe(false);
    expect(selectClause.expressions).toEqual(expressions);
});

test('math: 3', () => {
    const selectClause = transpileSelectClause(`"A" ^ true`);
    const expressions: Expression[] = [{ pattern: '$ ^ true', fields: ['"A"'], functions: [] }];
    expect(selectClause.star).toBe(false);
    expect(selectClause.expressions).toEqual(expressions);
});

test('math: 4', () => {
    const selectClause = transpileSelectClause(`A - 5, 2 * "B"`);
    const expressions: Expression[] = [
        { pattern: '$ - 5', fields: ['"A"'], functions: [] },
        { pattern: '2 * $', fields: ['"B"'], functions: [] },
    ];
    expect(selectClause.star).toBe(false);
    expect(selectClause.expressions).toEqual(expressions);
});

test('math: 5', () => {
    const selectClause = transpileSelectClause(`sum((((used)) * 100 + "A")) * 5 / derivative(30 - sum("total"), 10.5s)`);
    const expressions: Expression[] = [
        {
            pattern: '# * 5 / #',
            fields: [],
            functions: [
                {
                    fn: 'sum',
                    arguments: [
                        {
                            pattern: '($) * 100 + $',
                            fields: [
                                '"used"',
                                '"A"',
                            ],
                            functions: [],
                        },
                    ],
                },
                {
                    fn: 'derivative',
                    arguments: [
                        {
                            pattern: '30 - #',
                            fields: [],
                            functions: [
                                {
                                    fn: 'sum',
                                    arguments: [
                                        {
                                            pattern: '$',
                                            fields: [
                                                '"total"',
                                            ],
                                            functions: [],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            pattern: '10.5s',
                            fields: [],
                            functions: [],
                        },
                    ],
                },
            ],
        },
    ];
    expect(selectClause.star).toBe(false);
    expect(selectClause.expressions).toEqual(expressions);
});

// NOT SUPPORTED!
// test('count *', () => {
//     const selectClause = transpileSelectClause(`count(*)`);
//     const expressions: Expression[] = [
//         {
//             pattern: '#', fields: [], functions: [{
//                 fn: 'count', arguments: [
//                     { pattern: '*', fields: [], functions: [] },
//                 ],
//             }],
//         },
//     ];
//     expect(selectClause.star).toBe(false);
//     expect(selectClause.expressions).toEqual(expressions);
// });
