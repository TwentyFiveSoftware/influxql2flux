export interface Pipeline {
    stages: PipelineStage[];
}

export interface PipelineStage {
    fn: string;
    arguments: { [key: string]: string | PipelineStage[] };
}

export interface FluxFunctionLookupTable {
    [influxFnName: string]: (
        {
            fluxFnName: string,
            argsMapping?: (args: string[]) => { [arg: string]: string }
        });
}
