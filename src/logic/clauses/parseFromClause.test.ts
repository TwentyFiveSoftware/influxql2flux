import { parseFromClause } from './parseFromClause';

test('measurement only', () => {
    const fromClause = parseFromClause(`"cpu"`);
    expect(fromClause.bucket).toBeUndefined();
    expect(fromClause.retention).toBeUndefined();
    expect(fromClause.measurement).toBe(`cpu`);
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
    expect(fromClause.bucket).toBeUndefined();
    expect(fromClause.retention).toBeUndefined();
    expect(fromClause.measurement).toBeUndefined();
});

test('no quotes tolerance (measurement)', () => {
    const fromClause = parseFromClause(`memory_usage`);
    expect(fromClause.bucket).toBeUndefined();
    expect(fromClause.retention).toBeUndefined();
    expect(fromClause.measurement).toBe(`memory_usage`);
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

test('invalid', () => {
    const invalidClauses = [
        `."autogen"`,
        `'a'."b"."c"."d"`,
        `"abc"(xx)`,
        `"xxx`,
        `xx."a."x"`,
        `xx."a."x"`,
        `system..`,
        `system...x`,
        `..x`,
    ];

    for (const invalidClause of invalidClauses) {
        const fromClause = parseFromClause(invalidClause);
        expect(fromClause.bucket).toBeUndefined();
        expect(fromClause.retention).toBeUndefined();
        expect(fromClause.measurement).toBeUndefined();
    }
});
