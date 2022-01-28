import { parseGroupByClause } from './parseGroupByClause';

test('empty', () => {
    const groupByClause = parseGroupByClause(``);
    expect(groupByClause.columns).toEqual([]);
    expect(groupByClause.star).toBe(false);
    expect(groupByClause.timeInterval).toBeUndefined();
});

test('star', () => {
    const groupByClause = parseGroupByClause(`*`);
    expect(groupByClause.columns).toEqual([]);
    expect(groupByClause.star).toBe(true);
    expect(groupByClause.timeInterval).toBeUndefined();
});

test('1 column (quotes)', () => {
    const groupByClause = parseGroupByClause(`"cpu"`);
    expect(groupByClause.columns).toEqual(['"cpu"']);
    expect(groupByClause.star).toBe(false);
    expect(groupByClause.timeInterval).toBeUndefined();
});

test('1 column (no quotes)', () => {
    const groupByClause = parseGroupByClause(`cpu`);
    expect(groupByClause.columns).toEqual(['"cpu"']);
    expect(groupByClause.star).toBe(false);
    expect(groupByClause.timeInterval).toBeUndefined();
});

test('2 columns', () => {
    const groupByClause = parseGroupByClause(`"water level", "country"`);
    expect(groupByClause.columns).toEqual(['"water level"', '"country"']);
    expect(groupByClause.star).toBe(false);
    expect(groupByClause.timeInterval).toBeUndefined();
});

test('3 columns', () => {
    const groupByClause = parseGroupByClause(`'host', name, "country"`);
    expect(groupByClause.columns).toEqual(['"host"', '"name"', '"country"']);
    expect(groupByClause.star).toBe(false);
    expect(groupByClause.timeInterval).toBeUndefined();
});

test('time 1', () => {
    const groupByClause = parseGroupByClause(`time(12s)`);
    expect(groupByClause.columns).toEqual([]);
    expect(groupByClause.star).toBe(false);
    expect(groupByClause.timeInterval).toEqual(`12s`);
});

test('time 2', () => {
    const groupByClause = parseGroupByClause(` time(5d )`);
    expect(groupByClause.columns).toEqual([]);
    expect(groupByClause.star).toBe(false);
    expect(groupByClause.timeInterval).toEqual(`5d`);
});

test('time 3', () => {
    const groupByClause = parseGroupByClause(`time()`);
    expect(groupByClause.columns).toEqual([]);
    expect(groupByClause.star).toBe(false);
    expect(groupByClause.timeInterval).toBeUndefined();
});

test('time ($interval)', () => {
    const groupByClause = parseGroupByClause(`time($interval)`);
    expect(groupByClause.columns).toEqual([]);
    expect(groupByClause.star).toBe(false);
    expect(groupByClause.timeInterval).toEqual(`v.windowPeriod`);
});

test('time and columns', () => {
    const groupByClause = parseGroupByClause(`'user', time(12.3mo), "host"`);
    expect(groupByClause.columns).toEqual(['"user"', '"host"']);
    expect(groupByClause.star).toBe(false);
    expect(groupByClause.timeInterval).toEqual(`12.3mo`);
});

test('star and columns (invalid)', () => {
    const groupByClause = parseGroupByClause(`'user', *`);
    expect(groupByClause.columns).toEqual(['"user"']);
    expect(groupByClause.star).toBe(false);
    expect(groupByClause.timeInterval).toBeUndefined();
});

test('invalid columns', () => {
    const groupByClause = parseGroupByClause(`'user', a b,  5`);
    expect(groupByClause.columns).toEqual(['"user"', '"a b"', '"5"']);
    expect(groupByClause.star).toBe(false);
    expect(groupByClause.timeInterval).toBeUndefined();
});

test('invalid chars', () => {
    const groupByClause = parseGroupByClause(`('user')`);
    expect(groupByClause.columns).toEqual([]);
    expect(groupByClause.star).toBe(false);
    expect(groupByClause.timeInterval).toBeUndefined();
});
