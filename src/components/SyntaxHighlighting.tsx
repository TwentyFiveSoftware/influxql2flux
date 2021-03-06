import React, { useEffect } from 'react';
import styles from '../styles/SyntaxHighlighting.module.scss';

interface Props {
    code: string;
}

const SyntaxHighlighting = ({ code }: Props) => {
    const lines = code.split('\n')
        .map(line => {
            if (line.trim().length === 0)
                return [{ text: ' ', color: '' }];


            let tokens: { color: string, text: string, index: number }[] = [];

            for (const fn of line.matchAll(/([a-z]+)\(/gi))
                tokens.push({ color: '#61AFEF', text: fn[1] ?? '', index: fn.index ?? 0 });

            for (const fn of line.matchAll(/(\|>)|(fn):/gi))
                tokens.push({ color: '#56B6C2', text: fn[1] ?? fn[2] ?? '', index: fn.index ?? 0 });

            for (const fn of line.matchAll(/("[^"]*")/gi))
                tokens.push({ color: '#98C379', text: fn[1] ?? '', index: fn.index ?? 0 });

            for (const fn of line.matchAll(/([a-z_]+):/gi))
                if (fn[1] !== 'fn')
                    tokens.push({ color: '#E06C75', text: fn[1] ?? '', index: fn.index ?? 0 });

            for (const fn of line.matchAll(/\(([a-z_]+)\) *=>|.([a-z_]+)[.[]/gi))
                tokens.push({ color: '#D19A66', text: fn[1] ?? fn[2] ?? '', index: (fn.index ?? 0) + 1 });

            for (const fn of line.matchAll(/\({ ([a-z_]+)/gi))
                tokens.push({ color: '#D19A66', text: fn[1] ?? '', index: (fn.index ?? 0) + 3 });

            for (const fn of line.matchAll(/[^0-9_](-?[0-9]+(?:\.[0-9]*)?(?:y|mo|w|d|h|m|s|ms|us|µs|ns)?)/gi))
                tokens.push({ color: '#D19A66', text: fn[1] ?? '', index: (fn.index ?? 0) + 1 });

            // "T, Z, :" in timestamps (2022-01-01T00:00:00Z)
            for (const fn of line.matchAll(/[0-9]{2}(T)|[0-9]{2}(Z)|[0-9]{2}(:)/gi))
                tokens.push({ color: '#D19A66', text: fn[1] ?? fn[2] ?? fn[3] ?? '', index: (fn.index ?? 0) + 2 });

            for (const fn of line.matchAll(/(==|>=|<=|=~|!~|!=| and | or | with )/gi))
                tokens.push({ color: '#C678DD', text: fn[1] ?? '', index: fn.index ?? 0 });

            for (const fn of line.matchAll(/ (>) | (<) | ([+*\\|%^&-]) | (true)[ )]| (false)[ )]/gi))
                tokens.push({
                    color: '#C678DD', text: fn[1] ?? fn[2] ?? fn[3] ?? fn[4] ?? fn[5] ?? '',
                    index: (fn.index ?? 0) + 1,
                });


            // remove "double colored" tokens (e.g "true" and true)
            tokens = tokens.filter(token => !tokens.filter(t => t !== token)
                .some(t => t.index <= token.index && t.index + t.text.length >= token.index + token.text.length));


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

            if (e.ctrlKey && e.key === 'a') {
                e.preventDefault();

                const selection = window.getSelection();

                const from = document.querySelector('code');
                const to = document.querySelector('code div:last-child');
                if (selection && from && to)
                    selection.setBaseAndExtent(from, 0, to, 0);
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
                    {line.map((token, index) => (
                        <span className={styles.token} key={index} style={{ color: token.color }}>{token.text}</span>
                    ))}
                </div>
            ))}
            <div />
        </code>
    );
};

export default SyntaxHighlighting;
