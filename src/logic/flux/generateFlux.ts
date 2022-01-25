import type { Pipeline } from './types';

export const generateFlux = (pipeline: Pipeline): string => {
    let flux = '';

    for (const stage of pipeline.stages) {
        const args = Object.keys(stage.arguments).map(key => `${key}: ${stage.arguments[key]}`).join(', ');
        const fn = `${stage.fn}(${args})`;
        flux += flux === '' ? fn : `\n  |> ${fn}`;
    }

    return flux;
};
