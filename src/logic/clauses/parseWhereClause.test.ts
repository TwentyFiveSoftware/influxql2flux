import { parseWhereClause } from './parseWhereClause';
import type { WhereClause } from './types';

test('empty', () => {
    const whereClause = parseWhereClause(``);
    expect(whereClause.filters).toBeUndefined();
});

test('equals', () => {
    const whereClause = parseWhereClause(`host = "frontend"`);
    const expected: WhereClause.Filter =
        { fields: ['host'], operator: '==', value: '"frontend"' };
    expect(whereClause.filters).toEqual(expected);
});

test('less', () => {
    const whereClause = parseWhereClause(`time   < '2022-01-01T00:00:00Z'`);
    expect(whereClause.filters).toBeUndefined();
    expect(whereClause.timeFilters).toEqual(
        [{ fields: ['_time'], operator: '<', value: '2022-01-01T00:00:00Z' }]);
});

test('greater equals', () => {
    const whereClause = parseWhereClause(`_value >= -25.25`);
    const expected: WhereClause.Filter =
        { fields: ['_value'], operator: '>=', value: '-25.25' };
    expect(whereClause.filters).toEqual(expected);
});

test('not equals (<>)', () => {
    const whereClause = parseWhereClause(`"impact location" <> "Europe"`);
    const expected: WhereClause.Filter =
        { fields: ['"impact location"'], operator: '!=', value: '"Europe"' };
    expect(whereClause.filters).toEqual(expected);
});

test('not equals (!=)', () => {
    const whereClause = parseWhereClause(`(("impact location" != "Europe"))`);
    const expected: WhereClause.Filter =
        { fields: ['"impact location"'], operator: '!=', value: '"Europe"' };
    expect(whereClause.filters).toEqual(expected);
});

test('regex (=~)', () => {
    const whereClause = parseWhereClause(`'host' =~ /^[a-z]+-eu$/`);
    const expected: WhereClause.Filter =
        { fields: ['host'], operator: '=~', value: '/^[a-z]+-eu$/' };
    expect(whereClause.filters).toEqual(expected);
});

test('regex (!~)', () => {
    const whereClause = parseWhereClause(`'host' !~   /^[0-9]+$/`);
    const expected: WhereClause.Filter =
        { fields: ['host'], operator: '!~', value: '/^[0-9]+$/' };
    expect(whereClause.filters).toEqual(expected);
});

test('boolean as value', () => {
    const whereClause = parseWhereClause(`a ^ 25 = true`);
    const expected: WhereClause.Filter =
        { fields: ['a'], fieldsPattern: '$ ^ 25', operator: '==', value: 'true' };
    expect(whereClause.filters).toEqual(expected);
});

test('multiple conditions (and) 1', () => {
    const whereClause = parseWhereClause(`'user agent' = 'Chrome' and region <> "Northern America"`);
    const expected: WhereClause.Condition = {
        type: 'and',
        variables: [
            { fields: ['"user agent"'], operator: '==', value: '"Chrome"' },
            { fields: ['region'], operator: '!=', value: '"Northern America"' },
        ],
    };
    expect(whereClause.filters).toEqual(expected);
});

test('multiple conditions (and) 2', () => {
    const whereClause = parseWhereClause(`a = 1 and b = 2 and c = 3`);
    const expected: WhereClause.Condition = {
        type: 'and',
        variables: [
            { fields: ['a'], operator: '==', value: '1' },
            { fields: ['b'], operator: '==', value: '2' },
            { fields: ['c'], operator: '==', value: '3' },
        ],
    };
    expect(whereClause.filters).toEqual(expected);
});

test('multiple conditions (and) 3', () => {
    const whereClause = parseWhereClause(`(_value >= -3.5 and _value <= 9999) and time > now() - 7d`);
    const expected: WhereClause.Condition = {
        type: 'and',
        variables: [
            { fields: ['_value'], operator: '>=', value: '-3.5' },
            { fields: ['_value'], operator: '<=', value: '9999' },
        ],
    };
    expect(whereClause.filters).toEqual(expected);
    expect(whereClause.timeFilters).toEqual([{ fields: ['_time'], operator: '>', value: '-7d' }]);
});

test('multiple conditions (or) 1', () => {
    const whereClause = parseWhereClause(`a = 1 or b = 2 or c = 3`);
    const expected: WhereClause.Condition = {
        type: 'or',
        variables: [
            { fields: ['a'], operator: '==', value: '1' },
            { fields: ['b'], operator: '==', value: '2' },
            { fields: ['c'], operator: '==', value: '3' },
        ],
    };
    expect(whereClause.filters).toEqual(expected);
});

test('multiple conditions (or) 2', () => {
    const whereClause = parseWhereClause(`a = 1 or (b = 2 or (c = 3))`);
    const expected: WhereClause.Condition = {
        type: 'or',
        variables: [
            { fields: ['a'], operator: '==', value: '1' },
            {
                type: 'or',
                variables: [
                    { fields: ['b'], operator: '==', value: '2' },
                    { fields: ['c'], operator: '==', value: '3' },
                ],
            },
        ],
    };
    expect(whereClause.filters).toEqual(expected);
});

test('and/or precedence', () => {
    const whereClause = parseWhereClause(`a > 5 or b = 7 and c = 3`);
    const expected: WhereClause.Condition = {
        type: 'or',
        variables: [
            { fields: ['a'], operator: '>', value: '5' },
            {
                type: 'and',
                variables: [
                    { fields: ['b'], operator: '==', value: '7' },
                    { fields: ['c'], operator: '==', value: '3' },
                ],
            },
        ],
    };
    expect(whereClause.filters).toEqual(expected);
});

test('complex and / or', () => {
    const whereClause = parseWhereClause(
        `((a > 5 or (b = 7)) and ((c != 5))) and d = 99 or (e <> 25 or f = 9)`);
    const expected: WhereClause.Condition = {
        type: 'or',
        variables: [
            {
                type: 'and',
                variables: [
                    {
                        type: 'and',
                        variables: [
                            {
                                type: 'or',
                                variables: [
                                    { fields: ['a'], operator: '>', value: '5' },
                                    { fields: ['b'], operator: '==', value: '7' },
                                ],
                            },
                            { fields: ['c'], operator: '!=', value: '5' },
                        ],
                    },
                    { fields: ['d'], operator: '==', value: '99' },
                ],
            },
            {
                type: 'or',
                variables: [
                    { fields: ['e'], operator: '!=', value: '25' },
                    { fields: ['f'], operator: '==', value: '9' },
                ],
            },
        ],
    };
    expect(whereClause.filters).toEqual(expected);
});

test('arithmetic (addition) 1', () => {
    const whereClause = parseWhereClause(`"water_level" + 2 > 11.9`);
    const expected: WhereClause.Filter =
        { fields: ['water_level'], fieldsPattern: '$ + 2', operator: '>', value: '11.9' };
    expect(whereClause.filters).toEqual(expected);
});

test('arithmetic (addition) 2', () => {
    const whereClause = parseWhereClause(`"A a" + "B" = 10`);
    const expected: WhereClause.Filter =
        { fields: ['"A a"', 'B'], fieldsPattern: '$ + $', operator: '==', value: '10' };
    expect(whereClause.filters).toEqual(expected);
});

test('arithmetic (subtraction) 1', () => {
    const whereClause = parseWhereClause(`1 -   a - "b b bb"   -  'c' <= 3`);
    const expected: WhereClause.Filter =
        { fields: ['a', '"b b bb"', 'c'], fieldsPattern: '1 - $ - $ - $', operator: '<=', value: '3' };
    expect(whereClause.filters).toEqual(expected);
});

test('arithmetic (subtraction) 2', () => {
    const whereClause = parseWhereClause(`-a < -2.5`);
    const expected: WhereClause.Filter =
        { fields: ['a'], fieldsPattern: '-$', operator: '<', value: '-2.5' };
    expect(whereClause.filters).toEqual(expected);
});

test('arithmetic (multiplication) 1', () => {
    const whereClause = parseWhereClause(`a * 10 >= 20`);
    const expected: WhereClause.Filter =
        { fields: ['a'], fieldsPattern: '$ * 10', operator: '>=', value: '20' };
    expect(whereClause.filters).toEqual(expected);
});

test('arithmetic (multiplication) 2', () => {
    const whereClause = parseWhereClause(`(a + "b") * 3.5 - -1 > 999`);
    const expected: WhereClause.Filter =
        { fields: ['a', 'b'], fieldsPattern: '($ + $) * 3.5 - -1', operator: '>', value: '999' };
    expect(whereClause.filters).toEqual(expected);
});

test('arithmetic (division)', () => {
    const whereClause = parseWhereClause(`100 / 'A' / "B" != 2`);
    const expected: WhereClause.Filter =
        { fields: ['A', 'B'], fieldsPattern: '100 / $ / $', operator: '!=', value: '2' };
    expect(whereClause.filters).toEqual(expected);
});

test('arithmetic (modulo)', () => {
    const whereClause = parseWhereClause(`a % 2 = 0`);
    const expected: WhereClause.Filter =
        { fields: ['a'], fieldsPattern: '$ % 2', operator: '==', value: '0' };
    expect(whereClause.filters).toEqual(expected);
});

test('arithmetic (bitwise and)', () => {
    const whereClause = parseWhereClause(`(a & 15 > 0)`);
    const expected: WhereClause.Filter =
        { fields: ['a'], fieldsPattern: '$ & 15', operator: '>', value: '0' };
    expect(whereClause.filters).toEqual(expected);
});

test('arithmetic (bitwise or)', () => {
    const whereClause = parseWhereClause(`((a | b) <> 0)`);
    const expected: WhereClause.Filter =
        { fields: ['a', 'b'], fieldsPattern: '$ | $', operator: '!=', value: '0' };
    expect(whereClause.filters).toEqual(expected);
});

test('arithmetic (bitwise exclusive-or)', () => {
    const whereClause = parseWhereClause(`a ^ true = 2`);
    const expected: WhereClause.Filter =
        { fields: ['a'], fieldsPattern: '$ ^ true', operator: '==', value: '2' };
    expect(whereClause.filters).toEqual(expected);
});

test('nested ands', () => {
    const whereClause = parseWhereClause(`a > 5 and ((b < 3 and c = 5) and d = 9)`);
    const expected: WhereClause.Condition = {
        type: 'and',
        variables: [
            { fields: ['a'], operator: '>', value: '5' },
            { fields: ['b'], operator: '<', value: '3' },
            { fields: ['c'], operator: '==', value: '5' },
            { fields: ['d'], operator: '==', value: '9' },
        ],
    };
    expect(whereClause.filters).toEqual(expected);
});

test('time filters 1', () => {
    const whereClause = parseWhereClause(`time > now() - 14d and time < now() + 12h`);
    expect(whereClause.filters).toBeUndefined();
    expect(whereClause.timeFilters).toEqual([
        { fields: ['_time'], operator: '>', value: '-14d' },
        { fields: ['_time'], operator: '<', value: '+12h' },
    ]);
});

test('time filters 2', () => {
    const whereClause = parseWhereClause(`time > now() - 14d and (a > 5 or time < now() + 1.5mo)`);
    const expected: WhereClause.Condition = {
        type: 'or',
        variables: [
            { fields: ['a'], operator: '>', value: '5' },
            { fields: ['_time'], operator: '<', value: 'now() + 1.5mo' },
        ],
    };
    expect(whereClause.filters).toEqual(expected);
    expect(whereClause.timeFilters).toEqual([
        { fields: ['_time'], operator: '>', value: '-14d' },
    ]);
});

test('time filters 3', () => {
    const whereClause = parseWhereClause(`time >= now()`);
    expect(whereClause.filters).toBeUndefined();
    expect(whereClause.timeFilters).toEqual([
        { fields: ['_time'], operator: '>=', value: 'now()' },
    ]);
});
