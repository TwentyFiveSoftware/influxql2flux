export interface Clauses {
    select?: SelectClause.Clause;
    from?: FromClause.Clause;
    where?: WhereClause.Clause;
    groupBy?: GroupByClause.Clause;
    fill?: FillClause.Clause;
}

export namespace SelectClause {
    export interface Clause {
        star: boolean;
        expressions: Expression[];
    }

    export interface Expression {
        pattern: string;
        fields: string[];
        functions: Fn[];
    }

    export interface Fn {
        fn: string;
        arguments: Expression[];
    }
}

export namespace FromClause {
    export interface Clause {
        bucket: string;
        retention?: string;
        measurement?: string;
    }
}

export namespace WhereClause {
    export interface Clause {
        filters?: Condition | Filter;
        timeFilters: Filter[];
    }

    export interface Condition {
        type: 'and' | 'or',
        variables: (Condition | Filter)[];
    }

    export interface Filter {
        fields: string[];
        fieldsPattern?: string;
        operator: string;
        value: string;
    }

    export type Filters = WhereClause.Condition | WhereClause.Filter | undefined;
}

export namespace GroupByClause {
    export interface Clause {
        columns: string[];
        star: boolean;
        timeInterval?: string;
    }
}

export namespace FillClause {
    export interface Clause {
        usePrevious: boolean;
        value: string;
    }
}
