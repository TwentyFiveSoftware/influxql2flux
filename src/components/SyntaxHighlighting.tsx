import React, { useEffect } from 'react';
import styles from '../styles/SyntaxHighlighting.module.scss';

interface Props {
    code: string;
}

const SyntaxHighlighting = ({ code }: Props) => {
    const lines = code.split('\n')
        .map(line => line.replace(/ /g, '\t'))
        .filter(line => line.trim().length > 0)
        .map(line => {
            const tokens: { color: string, text: string, index: number }[] = [];

            for (const fn of line.matchAll(/([a-z]+)\(/gi))
                tokens.push({ color: '#61AFEF', text: fn[1] ?? '', index: fn.index ?? 0 });

            for (const fn of line.matchAll(/(\|>)|(fn):/gi))
                tokens.push({ color: '#56B6C2', text: fn[1] ?? fn[2] ?? '', index: fn.index ?? 0 });

            for (const fn of line.matchAll(/("[^"]*")/gi))
                tokens.push({ color: '#98C379', text: fn[1] ?? '', index: fn.index ?? 0 });

            for (const fn of line.matchAll(/([a-z]+):/gi))
                if (fn[1] !== 'fn')
                    tokens.push({ color: '#E06C75', text: fn[1] ?? '', index: fn.index ?? 0 });

            for (const fn of line.matchAll(/\(([a-z_]+)\)[ \t]*=>|.([a-z_]+)[.[]/gi))
                tokens.push({ color: '#D19A66', text: fn[1] ?? fn[2] ?? '', index: (fn.index ?? -1) + 1 });

            for (const fn of line.matchAll(/(-?[0-9]+(?:\.[0-9]*)?(?:y|mo|w|d|h|m|s|ms|us|µs|ns)?)/gi))
                tokens.push({ color: '#D19A66', text: fn[1] ?? '', index: fn.index ?? 0 });

            for (const fn of line.matchAll(/\t/g))
                tokens.push({ color: '', text: '\t', index: fn.index ?? 0 });


            const sortedTokens = tokens.sort((a, b) => a.index - b.index);

            const lineTokens: { color: string, text: string }[] = [];
            let currIndex = 0;

            for (const token of sortedTokens) {
                if (token.index > currIndex)
                    lineTokens.push({ color: '#ABB2BF', text: line.substring(currIndex, token.index) });

                lineTokens.push({ color: token.color, text: token.text });
                currIndex = token.index + token.text.length;
            }

            if (currIndex < line.length)
                lineTokens.push({ color: '#ABB2BF', text: line.substring(currIndex) });

            return lineTokens;
        });


    useEffect(() => {
        const keyDownEvent = (e: KeyboardEvent) => {
            if (document.activeElement !== document.querySelector('body'))
                return;

            if (e.ctrlKey && (e.key === 'a' || e.key === 'c')) {
                e.preventDefault();

                const selection = window.getSelection();
                const from = document.querySelector('code');
                const to = document.querySelector('code div:last-child');
                if (selection && from && to)
                    selection.setBaseAndExtent(from, 0, to, 0);

                if (e.key === 'c' && selection)
                    navigator.clipboard.writeText(selection.toString());
            }
        };

        document.addEventListener('keydown', keyDownEvent);

        return () => {
            document.removeEventListener('keydown', keyDownEvent);
        };
    });

    return (
        <code className={styles.code}>
            {lines.map((line, lineIndex) => (
                <div key={lineIndex}>
                    {line.map((token, index) =>
                        token.text === '\t' ? (
                            <span className={styles.token} key={index}>&nbsp;</span>
                        ) : (
                            <span className={styles.token} key={index} style={{ color: token.color }}>{token.text}</span>
                        ))}
                </div>
            ))}
            <div />
        </code>
    );
};

export default SyntaxHighlighting;
