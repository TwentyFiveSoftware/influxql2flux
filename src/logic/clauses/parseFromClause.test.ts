import { parseFromClause } from './parseFromClause';

test('database only', () => {
    const fromClause = parseFromClause(`"system"`);
    expect(fromClause.bucket).toBe(`system`);
    expect(fromClause.retention).toBeUndefined();
    expect(fromClause.measurement).toBeUndefined();
});

test('database and retention', () => {
    const fromClause = parseFromClause(`"system"."autogen"`);
    expect(fromClause.bucket).toBe(`system`);
    expect(fromClause.retention).toBe(`autogen`);
    expect(fromClause.measurement).toBeUndefined();
});

test('database, retention and measurement', () => {
    const fromClause = parseFromClause(`"system".'short term'.'cpu'`);
    expect(fromClause.bucket).toBe(`system`);
    expect(fromClause.retention).toBe(`short term`);
    expect(fromClause.measurement).toBe(`cpu`);
});

test('database and measurement', () => {
    const fromClause = parseFromClause(`'system'.."cpu"`);
    expect(fromClause.bucket).toBe(`system`);
    expect(fromClause.retention).toBeUndefined();
    expect(fromClause.measurement).toBe(`cpu`);
});

test('nothing', () => {
    const fromClause = parseFromClause(``);
    expect(fromClause.bucket).toBe(``);
    expect(fromClause.retention).toBeUndefined();
    expect(fromClause.measurement).toBeUndefined();
});

test('no quotes tolerance (database only)', () => {
    const fromClause = parseFromClause(`frontend`);
    expect(fromClause.bucket).toBe(`frontend`);
    expect(fromClause.retention).toBeUndefined();
    expect(fromClause.measurement).toBeUndefined();
});

test('no quotes tolerance (database, retention and measurement)', () => {
    const fromClause = parseFromClause(`frontend.long term.requests`);
    expect(fromClause.bucket).toBe(`frontend`);
    expect(fromClause.retention).toBe(`long term`);
    expect(fromClause.measurement).toBe(`requests`);
});

test('mixed quotes', () => {
    const fromClause = parseFromClause(`frontend.'long'."response time"`);
    expect(fromClause.bucket).toBe(`frontend`);
    expect(fromClause.retention).toBe(`long`);
    expect(fromClause.measurement).toBe(`response time`);
});

test('invalid (no database)', () => {
    const fromClause = parseFromClause(`."autogen"`);
    expect(fromClause.bucket).toBe(``);
    expect(fromClause.retention).toBeUndefined();
    expect(fromClause.measurement).toBeUndefined();
});

test('invalid', () => {
    const fromClause = parseFromClause(`'a'."b"."c"."d"`);
    expect(fromClause.bucket).toBe(``);
    expect(fromClause.retention).toBeUndefined();
    expect(fromClause.measurement).toBeUndefined();
});

test('invalid', () => {
    const fromClause = parseFromClause(`"abc"(xx)`);
    expect(fromClause.bucket).toBe(``);
    expect(fromClause.retention).toBeUndefined();
    expect(fromClause.measurement).toBeUndefined();
});

test('invalid', () => {
    const fromClause = parseFromClause(`"xxx`);
    expect(fromClause.bucket).toBe(``);
    expect(fromClause.retention).toBeUndefined();
    expect(fromClause.measurement).toBeUndefined();
});


test('invalid', () => {
    const fromClause = parseFromClause(`xx."a."x"`);
    expect(fromClause.bucket).toBe(``);
    expect(fromClause.retention).toBeUndefined();
    expect(fromClause.measurement).toBeUndefined();
});
