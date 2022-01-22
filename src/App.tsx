import React, { useEffect, useState } from 'react';
import styles from './styles/App.module.scss';
import { transpile } from './logic/transpile';
import TextareaAutosize from 'react-textarea-autosize';
import SyntaxHighlighting from './components/SyntaxHighlighting';

const App = () => {
    const [influxQL, setInfluxQL] = useState<string>('');
    const [flux, setFlux] = useState<string>('');

    useEffect(() => setFlux(transpile(influxQL)), [influxQL]);

    return (
        <div className={styles.app}>
            <main className={styles.main}>
                <h1 className={styles.headline}>InfluxQL to Flux transpiler</h1>

                <div className={styles.inputContainer}>
                    <TextareaAutosize className={styles.input} rows={1} placeholder={'Type your InfluxQL query here'}
                                      value={influxQL} onChange={e => setInfluxQL(e.target.value)} spellCheck={false} />
                </div>

                {flux.length > 0 && (
                    <div className={styles.outputContainer}>
                        <SyntaxHighlighting code={flux} />
                    </div>
                )}
            </main>
        </div>
    );
};

export default App;
