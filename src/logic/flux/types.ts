export interface Pipeline {
    from?: Stage.From;
    range?: Stage.Range;
    filters: Stage.Filter[];
    stages: PipelineStage[];
}

interface PipelineStage {
    fn: string;
    arguments: { key: string, value: string }[];
}

export namespace Stage {

    export interface From {
        bucket: string;
        retention?: string;
    }

    export interface Range {
        start?: string;
        stop?: string;
    }

    export interface Filter {
        pattern: string;
        fields: string[];
    }

}
