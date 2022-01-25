export interface Pipeline {
    stages: PipelineStage[];
}

export interface PipelineStage {
    fn: string;
    arguments: { [key: string]: string };
}
