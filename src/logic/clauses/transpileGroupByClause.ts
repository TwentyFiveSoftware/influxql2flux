interface GroupByClause {
    columns: string[];
    star: boolean;
    timeInterval?: string;
}

export const transpileGroupByClause = (influxQL: string): GroupByClause => {
    const groupByClause: GroupByClause = {
        columns: [],
        star: false,
    };

    let columns: string[] = influxQL
        .split(',')
        .map(c => c.trim().match(/^["']?([^"']*)["']?$/i))
        .map(c => c ? c[1].trim() : null)
        .filter(c => c !== null && c.length > 0) as string[];

    if (columns.length === 1 && columns[0] === '*')
        groupByClause.star = true;


    const timeGrouping = columns.map(c => c.match(/time\(.*\)/i)).filter(t => t !== null)[0];
    if (timeGrouping) {
        columns = columns.filter(c => c !== timeGrouping[0]);

        const interval = timeGrouping[0].match(/(-?[0-9]+(?:\.[0-9]+)?(?:y|mo|w|d|h|m|s|ms|us|µs|ns)?)/i);
        groupByClause.timeInterval = interval ? interval[1] : '';
    }


    columns = columns.filter(c => c !== '*').map(c => `"${c}"`);
    groupByClause.columns = columns;

    return groupByClause;
};
