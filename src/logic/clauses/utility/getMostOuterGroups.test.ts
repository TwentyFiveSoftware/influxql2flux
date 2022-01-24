import { getMostOuterGroups } from './getMostOuterGroups';

test.each([
    ['', ',', []],
    [',', ',', []],
    ['a, (b, c), d', ',', ['a', ' (b, c)', ' d']],
    ['a,(b, c),d', ', ', ['a,(b, c),d']],
    ['a == 0 and (b > 3 and c == 4)', ' and ', ['a == 0', '(b > 3 and c == 4)']],
    ['1 2  3', '  ', ['1 2', '3']],
])('test', (influxQL: string, connective: string, expected: string[]) => {
    expect(getMostOuterGroups(influxQL, connective)).toEqual(expected);
});
