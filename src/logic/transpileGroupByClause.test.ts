import { transpileGroupByClause } from './transpileGroupByClause';

test('empty', () => {
    const groupByClause = transpileGroupByClause(``);
    expect(groupByClause.columns).toEqual([]);
    expect(groupByClause.star).toBe(false);
    expect(groupByClause.timeInterval).toBeUndefined();
});

test('star', () => {
    const groupByClause = transpileGroupByClause(`*`);
    expect(groupByClause.columns).toEqual([]);
    expect(groupByClause.star).toBe(true);
    expect(groupByClause.timeInterval).toBeUndefined();
});

test('1 column (quotes)', () => {
    const groupByClause = transpileGroupByClause(`"cpu"`);
    expect(groupByClause.columns).toEqual(['"cpu"']);
    expect(groupByClause.star).toBe(false);
    expect(groupByClause.timeInterval).toBeUndefined();
});

test('1 column (no quotes)', () => {
    const groupByClause = transpileGroupByClause(`cpu`);
    expect(groupByClause.columns).toEqual(['"cpu"']);
    expect(groupByClause.star).toBe(false);
    expect(groupByClause.timeInterval).toBeUndefined();
});

test('2 columns', () => {
    const groupByClause = transpileGroupByClause(`"water level", "country"`);
    expect(groupByClause.columns).toEqual(['"water level"', '"country"']);
    expect(groupByClause.star).toBe(false);
    expect(groupByClause.timeInterval).toBeUndefined();
});

test('3 columns', () => {
    const groupByClause = transpileGroupByClause(`'host', name, "country"`);
    expect(groupByClause.columns).toEqual(['"host"', '"name"', '"country"']);
    expect(groupByClause.star).toBe(false);
    expect(groupByClause.timeInterval).toBeUndefined();
});

test('time 1', () => {
    const groupByClause = transpileGroupByClause(`time(12s)`);
    expect(groupByClause.columns).toEqual([]);
    expect(groupByClause.star).toBe(false);
    expect(groupByClause.timeInterval).toEqual(`12s`);
});

test('time 2', () => {
    const groupByClause = transpileGroupByClause(` time(5d )`);
    expect(groupByClause.columns).toEqual([]);
    expect(groupByClause.star).toBe(false);
    expect(groupByClause.timeInterval).toEqual(`5d`);
});

test('time 3', () => {
    const groupByClause = transpileGroupByClause(`time()`);
    expect(groupByClause.columns).toEqual([]);
    expect(groupByClause.star).toBe(false);
    expect(groupByClause.timeInterval).toEqual(``);
});

test('time and columns', () => {
    const groupByClause = transpileGroupByClause(`'user', time(12.3mo), "host"`);
    expect(groupByClause.columns).toEqual(['"user"', '"host"']);
    expect(groupByClause.star).toBe(false);
    expect(groupByClause.timeInterval).toEqual(`12.3mo`);
});

test('star and columns (invalid)', () => {
    const groupByClause = transpileGroupByClause(`'user', *`);
    expect(groupByClause.columns).toEqual(['"user"']);
    expect(groupByClause.star).toBe(false);
    expect(groupByClause.timeInterval).toBeUndefined();
});

test('invalid columns', () => {
    const groupByClause = transpileGroupByClause(`'user', a b,  5`);
    expect(groupByClause.columns).toEqual(['"user"', '"a b"', '"5"']);
    expect(groupByClause.star).toBe(false);
    expect(groupByClause.timeInterval).toBeUndefined();
});

test('invalid chars', () => {
    const groupByClause = transpileGroupByClause(`('user')`);
    expect(groupByClause.columns).toEqual([]);
    expect(groupByClause.star).toBe(false);
    expect(groupByClause.timeInterval).toBeUndefined();
});
