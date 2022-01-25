import { parseClauses } from './parseClauses';

test('empty', () => {
    const clauses = parseClauses(``);
    expect(clauses).toEqual({});
});

test('select, from', () => {
    const clauses = parseClauses(`SELECT "cpu_Usage" from "system"`);
    expect(clauses).toEqual({
        select: { star: false, expressions: [{ pattern: '$', fields: ['"cpu_Usage"'], functions: [] }] },
        from: { bucket: 'system' },
    });
});

test('select, from (math)', () => {
    const clauses = parseClauses(`select "a" * "b" from "c"."d"`);
    expect(clauses).toEqual({
        select: { star: false, expressions: [{ pattern: '$ * $', fields: ['"a"', '"b"'], functions: [] }] },
        from: { bucket: 'c', retention: 'd' },
    });
});

test('select, from, where', () => {
    const clauses = parseClauses(`select count(distinct("user_agent")) from "requests"."autogen"."frontend"
        where time >= 2022-01-01T00:00:00Z and time < now() - 1h`);

    expect(clauses).toEqual({
        select: {
            star: false,
            expressions: [{
                pattern: '#', fields: [], functions: [
                    {
                        fn: 'count', arguments: [{
                            pattern: '#', fields: [], functions: [
                                {
                                    fn: 'distinct', arguments: [
                                        { pattern: '$', fields: ['"user_agent"'], functions: [] },
                                    ],
                                },
                            ],
                        }],
                    },
                ],
            }],
        },
        from: { bucket: 'requests', retention: 'autogen', measurement: 'frontend' },
        where: {
            filters: {
                type: 'and',
                variables: [
                    { fields: ['time'], operator: '>=', value: '2022-01-01T00:00:00Z' },
                    { fields: ['time'], operator: '<', value: 'now() - 1h' },
                ],
            },
        },
    });
});

test('select, from, where (math)', () => {
    const clauses = parseClauses(`select "used" * 100 / "total" from 'system'
        where "type" = "memory" and ('host name' =~ /$host/ or region <> 'eu') and (("used" / "total")) > 0.3`);

    expect(clauses).toEqual({
        select: {
            star: false,
            expressions: [{
                pattern: '$ * 100 / $', fields: ['"used"', '"total"'], functions: [],
            }],
        },
        from: { bucket: 'system' },
        where: {
            filters: {
                type: 'and',
                variables: [
                    { fields: ['type'], operator: '==', value: '"memory"' },
                    {
                        type: 'or',
                        variables: [
                            { fields: ['"host name"'], operator: '=~', value: '/$host/' },
                            { fields: ['region'], operator: '!=', value: '"eu"' },
                        ],
                    },
                    { fields: ['used', 'total'], operator: '>', value: '0.3', fieldsPattern: '$ / $' },
                ],
            },
        },
    });
});

test('select, from, where, group', () => {
    const clauses = parseClauses(`select percentile("response_time", 99) from requests 
        where "status_code" > 200 group by time(2s), "host"`);

    expect(clauses).toEqual({
        select: {
            star: false,
            expressions: [{
                pattern: '#', fields: [], functions: [
                    {
                        fn: 'percentile', arguments: [
                            { pattern: '$', fields: ['"response_time"'], functions: [] },
                            { pattern: '99', fields: [], functions: [] },
                        ],
                    },
                ],
            }],
        },
        from: { bucket: 'requests' },
        where: {
            filters: { fields: ['status_code'], operator: '>', value: '200' },
        },
        groupBy: {
            star: false,
            columns: ['"host"'],
            timeInterval: '2s',
        },
    });
});

test('select, from, group', () => {
    const clauses = parseClauses(`select last("distance") from "tours" group by time(0.5mo)`);

    expect(clauses).toEqual({
        select: {
            star: false,
            expressions: [{
                pattern: '#', fields: [], functions: [
                    {
                        fn: 'last', arguments: [
                            { pattern: '$', fields: ['"distance"'], functions: [] },
                        ],
                    },
                ],
            }],
        },
        from: { bucket: 'tours' },
        groupBy: {
            star: false,
            columns: [],
            timeInterval: '0.5mo',
        },
    });
});

test('select, from, fill', () => {
    const clauses = parseClauses(`select "a" from "b" fill(previous)`);

    expect(clauses).toEqual({
        select: {
            star: false,
            expressions: [{ pattern: '$', fields: ['"a"'], functions: [] }],
        },
        from: { bucket: 'b' },
        fill: {
            usePrevious: true,
            value: '',
        },
    });
});

test('select, from, where, group, fill', () => {
    const clauses = parseClauses(
        `select " group by " from "fill" where "from" > 1 group by "from", "e" fill(previous); ;;`);

    expect(clauses).toEqual({
        select: {
            star: false,
            expressions: [{ pattern: '$', fields: ['" group by "'], functions: [] }],
        },
        from: { bucket: 'fill' },
        where: {
            filters: { fields: ['from'], operator: '>', value: '1' },
        },
        groupBy: {
            star: false,
            columns: ['"from"', '"e"'],
        },
        fill: {
            usePrevious: true,
            value: '',
        },
    });
});


test('select, from, group, fill', () => {
    const clauses = parseClauses(`select "a" + 3 from "b".."x" group by "c" fill(-1.23)`);

    expect(clauses).toEqual({
        select: {
            star: false,
            expressions: [{ pattern: '$ + 3', fields: ['"a"'], functions: [] }],
        },
        from: { bucket: 'b', measurement: 'x' },
        groupBy: {
            star: false,
            columns: ['"c"'],
        },
        fill: {
            usePrevious: false,
            value: '-1.23',
        },
    });
});

test('select, from, where, fill', () => {
    const clauses = parseClauses(`select max("a"), "b" from "c" where "d" !~ /xxx/ fill(none)`);

    expect(clauses).toEqual({
        select: {
            star: false,
            expressions: [
                {
                    pattern: '#', fields: [], functions: [
                        {
                            fn: 'max', arguments: [
                                { pattern: '$', fields: ['"a"'], functions: [] },
                            ],
                        },
                    ],
                },
                { pattern: '$', fields: ['"b"'], functions: [] },
            ],
        },
        from: { bucket: 'c' },
        where: {
            filters: { fields: ['d'], operator: '!~', value: '/xxx/' },
        },
        fill: {
            usePrevious: false,
            value: '',
        },
    });
});

test('autocorrect select', () => {
    const clauses = parseClauses(`select from x`);
    expect(clauses).toEqual({
        select: {
            star: true,
            expressions: [],
        },
        from: {
            bucket: 'x',
        },
    });
});

test('invalid 1', () => {
    const clauses = parseClauses(`from x`);
    expect(clauses).toEqual({});
});

test('invalid 2', () => {
    const clauses = parseClauses(`aaaaaaaa`);
    expect(clauses).toEqual({});
});

test('invalid 3', () => {
    const clauses = parseClauses(`select * from `);
    expect(clauses).toEqual({});
});
