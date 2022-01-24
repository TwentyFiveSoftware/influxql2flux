import { transpileFillClause } from './transpileFillClause';

test('empty', () => {
    const fillClause = transpileFillClause(``);
    expect(fillClause.usePrevious).toBe(false);
    expect(fillClause.value).toEqual('');
});

test('previous', () => {
    const fillClause = transpileFillClause(`fill(previous )`);
    expect(fillClause.usePrevious).toBe(true);
    expect(fillClause.value).toEqual('');
});

test('value 1', () => {
    const fillClause = transpileFillClause(`fill(12)`);
    expect(fillClause.usePrevious).toBe(false);
    expect(fillClause.value).toEqual('12');
});

test('value 2', () => {
    const fillClause = transpileFillClause(`fill(  -31.211 )`);
    expect(fillClause.usePrevious).toBe(false);
    expect(fillClause.value).toEqual('-31.211');
});

test('linear', () => {
    const fillClause = transpileFillClause(`fill(linear)`);
    expect(fillClause.usePrevious).toBe(false);
    expect(fillClause.value).toEqual('');
});

test('linear', () => {
    const fillClause = transpileFillClause(`fill(null)`);
    expect(fillClause.usePrevious).toBe(false);
    expect(fillClause.value).toEqual('');
});

test('none', () => {
    const fillClause = transpileFillClause(`fill(none)`);
    expect(fillClause.usePrevious).toBe(false);
    expect(fillClause.value).toEqual('');
});

test('invalid 1', () => {
    const fillClause = transpileFillClause(`fill()`);
    expect(fillClause.usePrevious).toBe(false);
    expect(fillClause.value).toEqual('');
});

test('invalid 2', () => {
    const fillClause = transpileFillClause(`xxxxx(12)`);
    expect(fillClause.usePrevious).toBe(false);
    expect(fillClause.value).toEqual('');
});
