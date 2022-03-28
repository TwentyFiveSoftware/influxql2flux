import React, { useEffect, useState } from 'react';
import styles from './styles/App.module.scss';
import { transpile } from './logic/transpile';
import TextareaAutosize from 'react-textarea-autosize';
import { Base64 } from 'js-base64';
import SyntaxHighlighting from './components/SyntaxHighlighting';

const App: React.FC = () => {
    const [influxQL, setInfluxQL] = useState<string>('');
    const [flux, setFlux] = useState<string>('');

    useEffect(() => setFlux(transpile(influxQL)), [influxQL]);

    useEffect(() => {
        setInfluxQL(Base64.decode(new URLSearchParams(window.location.search).get('q') ?? ''));
    }, []);

    const onInfluxQLChange = (value: string) => {
        setInfluxQL(value);
        window.history.pushState('', '', `/?q=${Base64.encode(value)}`);
    };

    return (
        <div className={styles.app}>
            <main className={styles.main}>
                <h1 className={styles.headline}>InfluxQL to Flux transpiler</h1>

                <div className={styles.inputContainer}>
                    <TextareaAutosize
                        className={styles.input}
                        rows={1}
                        placeholder={'Type your InfluxQL query here'}
                        value={influxQL}
                        onChange={e => onInfluxQLChange(e.target.value)}
                        spellCheck={false}
                    />
                </div>

                {flux.length > 0 && (
                    <div className={styles.outputContainer}>
                        <SyntaxHighlighting code={flux} />
                    </div>
                )}

                <a className={styles.github} href={'https://github.com/TwentyFiveSoftware/influxql2flux'}>
                    GitHub / TwentyFiveSoftware / influxql2flux
                </a>
            </main>
        </div>
    );
};

export default App;
