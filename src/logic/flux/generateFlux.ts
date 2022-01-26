import type { Pipeline, PipelineStage } from './types';

export const generateFlux = (pipeline: Pipeline): string => {
    let flux = '';

    for (const stage of pipeline.stages) {
        let args = Object.keys(stage.arguments).map(key => {
            let value = stage.arguments[key];

            if (Array.isArray(value))
                value = '(column, tables=<-) =>\n       tables |> '
                    + generateFlux({ stages: value as PipelineStage[] });

            return `${key}: ${value}`;
        }).join(', ');

        const fn = `${stage.fn}(${args})`;
        flux += flux === '' ? fn : `\n  |> ${fn}`;
    }

    return flux;
};
