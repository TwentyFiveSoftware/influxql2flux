import React from 'react';
import styles from './styles/App.module.scss';

const App = () => {
    return (
        <div className={styles.app}>
            <main className={styles.main}>
                <h1 className={styles.headline}>InfluxQL to Flux transpiler</h1>

                <div className={styles.inputContainer}>
                    <textarea className={styles.input} rows={1} placeholder={'Type your InfluxQL query here'} />
                </div>

                <div className={styles.outputContainer}>
                    <p className={styles.output}></p>
                </div>
            </main>
        </div>
    );
};

export default App;
