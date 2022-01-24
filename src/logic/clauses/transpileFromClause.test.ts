import { transpileFromClause } from './transpileFromClause';

test('database only', () => {
    const fromClause = transpileFromClause(`"system"`);
    expect(fromClause.bucket).toBe(`system`);
    expect(fromClause.retention).toBeUndefined();
    expect(fromClause.measurement).toBeUndefined();
});

test('database and retention', () => {
    const fromClause = transpileFromClause(`"system"."autogen"`);
    expect(fromClause.bucket).toBe(`system`);
    expect(fromClause.retention).toBe(`autogen`);
    expect(fromClause.measurement).toBeUndefined();
});

test('database, retention and measurement', () => {
    const fromClause = transpileFromClause(`"system".'short term'.'cpu'`);
    expect(fromClause.bucket).toBe(`system`);
    expect(fromClause.retention).toBe(`short term`);
    expect(fromClause.measurement).toBe(`cpu`);
});

test('database and measurement', () => {
    const fromClause = transpileFromClause(`'system'.."cpu"`);
    expect(fromClause.bucket).toBe(`system`);
    expect(fromClause.retention).toBeUndefined();
    expect(fromClause.measurement).toBe(`cpu`);
});

test('nothing', () => {
    const fromClause = transpileFromClause(``);
    expect(fromClause.bucket).toBe(``);
    expect(fromClause.retention).toBeUndefined();
    expect(fromClause.measurement).toBeUndefined();
});

test('no quotes tolerance (database only)', () => {
    const fromClause = transpileFromClause(`frontend`);
    expect(fromClause.bucket).toBe(`frontend`);
    expect(fromClause.retention).toBeUndefined();
    expect(fromClause.measurement).toBeUndefined();
});

test('no quotes tolerance (database, retention and measurement)', () => {
    const fromClause = transpileFromClause(`frontend.long term.requests`);
    expect(fromClause.bucket).toBe(`frontend`);
    expect(fromClause.retention).toBe(`long term`);
    expect(fromClause.measurement).toBe(`requests`);
});

test('mixed quotes', () => {
    const fromClause = transpileFromClause(`frontend.'long'."response time"`);
    expect(fromClause.bucket).toBe(`frontend`);
    expect(fromClause.retention).toBe(`long`);
    expect(fromClause.measurement).toBe(`response time`);
});

test('invalid (no database)', () => {
    const fromClause = transpileFromClause(`."autogen"`);
    expect(fromClause.bucket).toBe(``);
    expect(fromClause.retention).toBeUndefined();
    expect(fromClause.measurement).toBeUndefined();
});

test('invalid', () => {
    const fromClause = transpileFromClause(`'a'."b"."c"."d"`);
    expect(fromClause.bucket).toBe(``);
    expect(fromClause.retention).toBeUndefined();
    expect(fromClause.measurement).toBeUndefined();
});

test('invalid', () => {
    const fromClause = transpileFromClause(`"abc"(xx)`);
    expect(fromClause.bucket).toBe(``);
    expect(fromClause.retention).toBeUndefined();
    expect(fromClause.measurement).toBeUndefined();
});

test('invalid', () => {
    const fromClause = transpileFromClause(`"xxx`);
    expect(fromClause.bucket).toBe(``);
    expect(fromClause.retention).toBeUndefined();
    expect(fromClause.measurement).toBeUndefined();
});


test('invalid', () => {
    const fromClause = transpileFromClause(`xx."a."x"`);
    expect(fromClause.bucket).toBe(``);
    expect(fromClause.retention).toBeUndefined();
    expect(fromClause.measurement).toBeUndefined();
});
