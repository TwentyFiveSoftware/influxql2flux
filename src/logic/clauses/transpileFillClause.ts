interface FillClause {
    usePrevious: boolean;
    value: string;
}

export const transpileFillClause = (influxQL: string): FillClause => {
    const fillClause: FillClause = {
        usePrevious: false,
        value: '',
    };

    const fillPreviousMatch = influxQL.trim().match(/^fill\( *previous *\)$/i);
    if (fillPreviousMatch)
        fillClause.usePrevious = true;

    const fillNumberMatch = influxQL.trim().match(/^fill\( *(-?[0-9]+(?:\.[0-9]+)?) *\)$/i);
    if (fillNumberMatch)
        fillClause.value = fillNumberMatch[1] ?? '';

    return fillClause;
};
