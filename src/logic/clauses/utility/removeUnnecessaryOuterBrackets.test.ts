import { removeUnnecessaryOuterBrackets } from './removeUnnecessaryOuterBrackets';

test.each([
    ['', ''],
    ['()', ''],
    ['((((()))))', ''],
    ['((1 + 3) * 5)', '(1 + 3) * 5'],
    [' (( 1 + 3) * (5 ^ 2))', '( 1 + 3) * (5 ^ 2)'],
    ['(  ( 1 / 9)  )', '1 / 9'],
    ['( "A" and "c" or (c and b ))', '"A" and "c" or (c and b )'],
])('test', (influxQL: string, expected: string) => {
    expect(removeUnnecessaryOuterBrackets(influxQL)).toEqual(expected);
});
