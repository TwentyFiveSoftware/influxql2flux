import type { FillClause } from './types';
import { matchInfluxFunctions } from './utility/matchInfluxFunction';
import { REGEX_NUMBER } from './regexs';

export const parseFillClause = (influxQL: string): FillClause.Clause => {
    const fillClause: FillClause.Clause = {
        usePrevious: false,
        value: '',
    };

    const fn = matchInfluxFunctions(influxQL);

    const fillFn = fn.find(fn => fn.fn === 'fill' && fn.arguments.length === 1);
    if (!fillFn)
        return fillClause;


    const fillPreviousMatch = fillFn.arguments[0].toLowerCase().includes('previous');
    if (fillPreviousMatch)
        fillClause.usePrevious = true;

    const fillNumberMatch = fillFn.arguments[0].toLowerCase().match(REGEX_NUMBER);
    if (fillNumberMatch)
        fillClause.value = fillNumberMatch[1] ?? '';

    return fillClause;
};
