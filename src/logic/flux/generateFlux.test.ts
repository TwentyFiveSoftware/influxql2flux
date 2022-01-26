import { generateFlux } from './generateFlux';
import type { Pipeline } from './types';

test('empty', () => {
    const pipeline: Pipeline = { stages: [] };

    expect(generateFlux(pipeline)).toEqual('');
});

test('from', () => {
    const pipeline: Pipeline = {
        stages: [
            { fn: 'from', arguments: { bucket: '"system"' } },
        ],
    };

    const flux = 'from(bucket: "system")';
    expect(generateFlux(pipeline)).toEqual(flux);
});

test('from and range 1', () => {
    const pipeline: Pipeline = {
        stages: [
            { fn: 'from', arguments: { bucket: '"system/autogen"' } },
            { fn: 'range', arguments: { start: '-7d' } },
        ],
    };

    const flux =
        'from(bucket: "system/autogen")\n' +
        '  |> range(start: -7d)';
    expect(generateFlux(pipeline)).toEqual(flux);
});

test('from and range 2', () => {
    const pipeline: Pipeline = {
        stages: [
            { fn: 'from', arguments: { bucket: '"system/autogen"' } },
            { fn: 'range', arguments: { start: '2022-01-01T00:00:00Z', stop: 'now()' } },
        ],
    };

    const flux =
        'from(bucket: "system/autogen")\n' +
        '  |> range(start: 2022-01-01T00:00:00Z, stop: now())';
    expect(generateFlux(pipeline)).toEqual(flux);
});

test('_field filter', () => {
    const pipeline: Pipeline = {
        stages: [
            { fn: 'from', arguments: { bucket: '"system"' } },
            { fn: 'range', arguments: { start: '-7d', stop: '+14d' } },
            { fn: 'filter', arguments: { fn: '(r) => r._field == "cpu_usage"' } },
        ],
    };

    const flux =
        'from(bucket: "system")\n' +
        '  |> range(start: -7d, stop: +14d)\n' +
        '  |> filter(fn: (r) => r._field == "cpu_usage")';
    expect(generateFlux(pipeline)).toEqual(flux);
});

test('_measurement filter', () => {
    const pipeline: Pipeline = {
        stages: [
            { fn: 'from', arguments: { bucket: '"system"' } },
            { fn: 'range', arguments: { start: '-1mo', stop: 'now()' } },
            { fn: 'filter', arguments: { fn: '(r) => r._measurement == "cpu"' } },
            { fn: 'filter', arguments: { fn: '(r) => r["data center"] !~ /eu-[0-9]+/' } },
        ],
    };

    const flux =
        'from(bucket: "system")\n' +
        '  |> range(start: -1mo, stop: now())\n' +
        '  |> filter(fn: (r) => r._measurement == "cpu")\n' +
        '  |> filter(fn: (r) => r["data center"] !~ /eu-[0-9]+/)';
    expect(generateFlux(pipeline)).toEqual(flux);
});

test('nested filter', () => {
    const pipeline: Pipeline = {
        stages: [
            { fn: 'from', arguments: { bucket: '"system"' } },
            { fn: 'range', arguments: { start: '-1mo', stop: 'now()' } },
            { fn: 'filter', arguments: { fn: '(r) => (r.a + 10) * 1.5 > 20 or ((r["b b"] == "$a" or r.c < 0) and r.d != "x")' } },
        ],
    };

    const flux =
        'from(bucket: "system")\n' +
        '  |> range(start: -1mo, stop: now())\n' +
        '  |> filter(fn: (r) => (r.a + 10) * 1.5 > 20 or ((r["b b"] == "$a" or r.c < 0) and r.d != "x"))';
    expect(generateFlux(pipeline)).toEqual(flux);
});

test('time aggregation function with arguments', () => {
    const pipeline: Pipeline = {
        stages: [
            { fn: 'from', arguments: { bucket: '"system"' } },
            { fn: 'range', arguments: { start: '-1mo', stop: 'now()' } },
            { fn: 'aggregateWindow', arguments: { every: '10s', fn: [{ fn: 'quantile', arguments: { q: '0.975' } }] } },
        ],
    };

    const flux =
        'from(bucket: "system")\n' +
        '  |> range(start: -1mo, stop: now())\n' +
        '  |> aggregateWindow(every: 10s, fn: (column, tables=<-) =>\n       tables |> quantile(q: 0.975))';
    expect(generateFlux(pipeline)).toEqual(flux);
});
