import { parseFillClause } from './parseFillClause';

test('empty', () => {
    const fillClause = parseFillClause(``);
    expect(fillClause.usePrevious).toBe(false);
    expect(fillClause.value).toEqual('');
});

test('previous', () => {
    const fillClause = parseFillClause(`fill(previous )`);
    expect(fillClause.usePrevious).toBe(true);
    expect(fillClause.value).toEqual('');
});

test('value 1', () => {
    const fillClause = parseFillClause(` a(1), fill(12)`);
    expect(fillClause.usePrevious).toBe(false);
    expect(fillClause.value).toEqual('12');
});

test('value 2', () => {
    const fillClause = parseFillClause(`fill(  -31.211 )`);
    expect(fillClause.usePrevious).toBe(false);
    expect(fillClause.value).toEqual('-31.211');
});

test('linear', () => {
    const fillClause = parseFillClause(`fill(linear)`);
    expect(fillClause.usePrevious).toBe(false);
    expect(fillClause.value).toEqual('');
});

test('linear', () => {
    const fillClause = parseFillClause(`fill(null)`);
    expect(fillClause.usePrevious).toBe(false);
    expect(fillClause.value).toEqual('');
});

test('none', () => {
    const fillClause = parseFillClause(`fill( (none))`);
    expect(fillClause.usePrevious).toBe(false);
    expect(fillClause.value).toEqual('');
});

test('invalid 1', () => {
    const fillClause = parseFillClause(`fill()`);
    expect(fillClause.usePrevious).toBe(false);
    expect(fillClause.value).toEqual('');
});

test('invalid 2', () => {
    const fillClause = parseFillClause(`xxxxx(12)`);
    expect(fillClause.usePrevious).toBe(false);
    expect(fillClause.value).toEqual('');
});

test('invalid 3', () => {
    const fillClause = parseFillClause(`fill(2s)`);
    expect(fillClause.usePrevious).toBe(false);
    expect(fillClause.value).toEqual('');
});
