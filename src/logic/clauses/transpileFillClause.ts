import { matchInfluxFunctions } from './utility/matchInfluxFunction';
import { REGEX_NUMBER } from './regexs';

interface FillClause {
    usePrevious: boolean;
    value: string;
}

export const transpileFillClause = (influxQL: string): FillClause => {
    const fillClause: FillClause = {
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
