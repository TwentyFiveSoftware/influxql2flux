export const removeUnnecessaryOuterBrackets = (influxQL: string): string => {
    influxQL = influxQL.trim();

    while (influxQL.startsWith('(') && influxQL.endsWith(')')) {
        const newInfluxQL = influxQL.trim().substring(1, influxQL.length - 1).trim();

        let bracketStack = 0;
        for (let i = 0; i < newInfluxQL.length; i++) {
            if (newInfluxQL.charAt(i) === '(')
                bracketStack++;
            else if (newInfluxQL.charAt(i) === ')')
                bracketStack--;

            if (bracketStack < 0)
                break;
        }

        if (bracketStack < 0)
            break;

        influxQL = newInfluxQL;
    }

    return influxQL;
};
