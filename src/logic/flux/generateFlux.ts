import type { Pipeline, PipelineStage } from './types';

export const generateFlux = (pipelines: Pipeline[]): string => {
    const fluxPerPipeline: string[] = [];

    for (const pipeline of pipelines) {
        const fluxLines: string[] = [];

        for (const stage of pipeline.stages) {
            let args = Object.keys(stage.arguments).map(key => {
                let value = stage.arguments[key];

                if (Array.isArray(value))
                    value = '(column, tables=<-) =>\n       tables |> '
                        + generateFlux([{ stages: value as PipelineStage[] }]);

                return `${key}: ${value}`;
            }).join(', ');

            const fn = `${stage.fn}(${args})`;
            fluxLines.push(fn);
        }


        let fluxStart = '';

        if (pipeline.outputVariableName)
            fluxStart += `${pipeline.outputVariableName} = `;

        if (pipeline.inputVariableName) {
            fluxStart += `${pipeline.inputVariableName}`;
            fluxLines.unshift('');
        }

        fluxPerPipeline.push(fluxStart + fluxLines.join('\n  |> '));
    }

    return fluxPerPipeline.join('\n\n');
};
