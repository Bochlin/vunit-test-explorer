/* ------------------------------------------------------------------------------------------
 * MIT License
 * Copyright (c) 2019 Henrik Bohlin
 * Full license text can be found in /LICENSE or at https://opensource.org/licenses/MIT.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import {
    TestAdapter,
    TestEvent,
    TestLoadStartedEvent,
    TestLoadFinishedEvent,
    TestRunStartedEvent,
    TestRunFinishedEvent,
    TestSuiteInfo,
    TestSuiteEvent,
} from 'vscode-test-adapter-api';
import { Log } from 'vscode-test-adapter-util';
import {
    cancelRunVunitTests,
    getVunitVersion,
    loadVunitTests,
    runVunitTests,
    runVunitTestsInGui,
} from './vunit';
import { performance } from 'perf_hooks';

export class VUnitAdapter implements TestAdapter {
    private disposables: { dispose(): void }[] = [];

    private readonly testsEmitter = new vscode.EventEmitter<
        TestLoadStartedEvent | TestLoadFinishedEvent
    >();
    private readonly testStatesEmitter = new vscode.EventEmitter<
        TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent
    >();
    private readonly autorunEmitter = new vscode.EventEmitter<void>();

    private loadedTests: TestSuiteInfo = {
        type: 'suite',
        id: 'root',
        label: 'VUnit',
        children: [],
    };

    private watchedFiles: string[] = [];

    get tests(): vscode.Event<TestLoadStartedEvent | TestLoadFinishedEvent> {
        return this.testsEmitter.event;
    }
    get testStates(): vscode.Event<
        TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent
    > {
        return this.testStatesEmitter.event;
    }
    get autorun(): vscode.Event<void> | undefined {
        return this.autorunEmitter.event;
    }

    constructor(
        public readonly workspace: vscode.WorkspaceFolder,
        private readonly workDir: string,
        private readonly log: Log
    ) {
        this.log.info('Initializing VUnit adapter');

        this.disposables.push(this.testsEmitter);
        this.disposables.push(this.testStatesEmitter);
        this.disposables.push(this.autorunEmitter);
    }

    async load(): Promise<void> {
        await getVunitVersion()
            .then(res => {
                this.log.info(`Found VUnit version ${res}`);
            })
            .catch(err => {
                this.log.error(err);
                throw new Error('VUnit not found');
            });
        this.log.info('Loading VUnit tests...');
        this.testsEmitter.fire(<TestLoadStartedEvent>{ type: 'started' });
        let loadStart = performance.now();
        let vunitData = await loadVunitTests(this.workDir);
        let loadTime = performance.now() - loadStart;
        this.log.info(
            `Loading of tests finished after ${(loadTime / 1000).toFixed(
                3
            )} seconds.`
        );

        for (let file of vunitData.testFiles.concat(vunitData.runPy)) {
            if (!this.watchedFiles.includes(file)) {
                let fileWatcher = vscode.workspace.createFileSystemWatcher(
                    file
                );
                this.watchedFiles.push(file);
                fileWatcher.onDidChange(() => this.load());
                fileWatcher.onDidDelete(() => {
                    this.watchedFiles.splice(
                        this.watchedFiles.indexOf(file),
                        1
                    );
                    this.load();
                });
            }
        }

        this.loadedTests = vunitData.testSuiteInfo;

        this.testsEmitter.fire(<TestLoadFinishedEvent>{
            type: 'finished',
            suite: this.loadedTests,
        });
    }

    async run(tests: string[]): Promise<void> {
        this.log.info(`Running VUnit tests ${JSON.stringify(tests)}`);

        this.testStatesEmitter.fire(<TestRunStartedEvent>{
            type: 'started',
            tests,
        });

        await runVunitTests(tests, this.testStatesEmitter, this.loadedTests);

        this.testStatesEmitter.fire(<TestRunFinishedEvent>{ type: 'finished' });
    }

    async debug(tests: string[]): Promise<void> {
        runVunitTestsInGui(tests, this.loadedTests);
    }

    cancel(): void {
        cancelRunVunitTests();
    }

    dispose(): void {
        this.cancel();
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
    }
}
