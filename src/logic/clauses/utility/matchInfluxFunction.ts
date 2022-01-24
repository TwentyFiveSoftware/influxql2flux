import { removeUnnecessaryOuterBrackets } from './removeUnnecessaryOuterBrackets';

export interface InfluxFunction {
    fn: string;
    arguments: string[];
    fromIndex: number;
    toIndex: number;
}

export const matchInfluxFunctions = (influxQL: string): InfluxFunction[] => {
    const functions: InfluxFunction[] = [];

    while (true) {
        const fnMatch = influxQL.match(/[a-z0-9_]+ *\(/i);
        if (!fnMatch)
            break;

        const fnStartIndex = fnMatch.index ?? 0;
        let fnEndIndex = -1;

        let bracketStack = 0;
        for (let i = fnStartIndex; i < influxQL.length; i++) {
            if (influxQL.charAt(i) === '(')
                bracketStack++;
            else if (influxQL.charAt(i) === ')') {
                if (bracketStack === 1) {
                    fnEndIndex = i;
                    break;
                }

                bracketStack--;
            }
        }

        if (fnEndIndex === -1)
            break;

        const fn = influxQL.substring(fnStartIndex, fnEndIndex);
        const fnName = fn.split('(', 1)[0].trim().toLowerCase();
        const fnArguments = removeUnnecessaryOuterBrackets(fn.substring(fn.indexOf('(') + 1).trim())
            .split(',')
            .map(a => removeUnnecessaryOuterBrackets(a))
            .filter(a => a.length > 0);

        functions.push({ fn: fnName, arguments: fnArguments, fromIndex: fnStartIndex, toIndex: fnEndIndex });

        influxQL = influxQL.substring(0, fnStartIndex)
            + '#'.repeat(fnEndIndex - fnStartIndex + 1)
            + influxQL.substring(fnEndIndex + 1);
    }

    return functions;
};
