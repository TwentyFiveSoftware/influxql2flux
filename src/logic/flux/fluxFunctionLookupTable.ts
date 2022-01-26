import { FluxFunctionLookupTable } from './types';

// https://docs.influxdata.com/influxdb/v1.8/flux/flux-vs-influxql/#influxql-and-flux-parity
export const fluxFunctionLookupTable: FluxFunctionLookupTable = {
    count: { fluxFnName: 'count' },
    distinct: { fluxFnName: 'distinct' },
    integral: {
        fluxFnName: 'integral',
        argsMapping: (args) => ({ unit: args[0] ?? '' }),
    },
    mean: { fluxFnName: 'mean' },
    median: { fluxFnName: 'median' },
    mode: { fluxFnName: 'mode' },
    spread: { fluxFnName: 'spread' },
    sum: { fluxFnName: 'sum' },
    bottom: {
        fluxFnName: 'bottom',
        argsMapping: (args) => ({ n: args[0] ?? '' }),
    },
    first: { fluxFnName: 'first' },
    last: { fluxFnName: 'last' },
    max: { fluxFnName: 'max' },
    min: { fluxFnName: 'min' },
    percentile: {
        fluxFnName: 'quantile',
        argsMapping: (args) => ({ q: (Number(args[0] ?? '0') / 100).toString() }),
    },
    sample: {
        fluxFnName: 'sample',
        argsMapping: (args) => ({ n: args[0] ?? '' }),
    },
    top: {
        fluxFnName: 'top',
        argsMapping: (args) => ({ n: args[0] ?? '' }),
    },
    cumulative_sum: { fluxFnName: 'cumulativeSum' },
    derivative: {
        fluxFnName: 'derivative',
        argsMapping: (args) => ({ unit: args[0] ?? '', nonNegative: 'false' }),
    },
    difference: {
        fluxFnName: 'difference',
        argsMapping: () => ({ nonNegative: '"false"' }),
    },
    elapsed: {
        fluxFnName: 'elapsed',
        argsMapping: (args) => ({ unit: args[0] ?? '', nonNegative: 'false' }),
    },
    moving_average: {
        fluxFnName: 'movingAverage',
        argsMapping: (args) => ({ n: args[0] ?? '' }),
    },
    non_negative_derivative: {
        fluxFnName: 'derivative',
        argsMapping: (args) => ({ unit: args[0] ?? '', nonNegative: 'true' }),
    },
    non_negative_difference: {
        fluxFnName: 'difference',
        argsMapping: () => ({ nonNegative: '"true"' }),
    },
};
