export const getMostOuterGroups = (influxQL: string, connective: string): string[] => {
    const groups: string[] = [];

    let currentGroupStartIndex = 0;
    let bracketStack = 0;
    for (let i = 0; i < influxQL.length; i++) {
        if (influxQL.charAt(i) === '(')
            bracketStack++;
        else if (influxQL.charAt(i) === ')')
            bracketStack--;

        if (bracketStack === 0 && influxQL.substring(i).match(new RegExp(`^${connective}`, 'i'))) {
            groups.push(influxQL.substring(currentGroupStartIndex, i));
            currentGroupStartIndex = i + connective.length;
        }
    }

    groups.push(influxQL.substring(currentGroupStartIndex));

    return groups.filter(group => group.length > 0);
};
