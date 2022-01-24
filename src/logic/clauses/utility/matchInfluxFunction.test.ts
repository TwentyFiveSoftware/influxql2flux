import { InfluxFunction, matchInfluxFunctions } from './matchInfluxFunction';

test.each([
    ['', []],
    ['count("field")', [{ fn: 'count', arguments: ['"field"'], fromIndex: 0, toIndex: 13 }]],
    [' fill(-3.9)  ', [{ fn: 'fill', arguments: ['-3.9'], fromIndex: 1, toIndex: 10 }]],
    ['fill()', [{ fn: 'fill', arguments: [], fromIndex: 0, toIndex: 5 }]],
    ['  fill(( (previous)))', [{ fn: 'fill', arguments: ['previous'], fromIndex: 2, toIndex: 20 }]],
    ['(derivative("field", 2.5s))', [{ fn: 'derivative', arguments: ['"field"', '2.5s'], fromIndex: 1, toIndex: 25 }]],

    ['top (xxx, 99  ) , fill( none)', [{ fn: 'top', arguments: ['xxx', '99'], fromIndex: 0, toIndex: 14 },
        { fn: 'fill', arguments: ['none'], fromIndex: 18, toIndex: 28 }]],

    [' abc(1, 2, test) c(x)', [{ fn: 'abc', arguments: ['1', '2', 'test'], fromIndex: 1, toIndex: 15 },
        { fn: 'c', arguments: ['x'], fromIndex: 17, toIndex: 20 }]],

    ['a("xxx", b("c"))', [{ fn: 'a', arguments: ['"xxx"', 'b("c")'], fromIndex: 0, toIndex: 15 }]],

])('test', (influxQL: string, expected: InfluxFunction[]) => {
    expect(matchInfluxFunctions(influxQL)).toEqual(expected);
});
