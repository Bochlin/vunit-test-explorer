/* ------------------------------------------------------------------------------------------
 * MIT License
 * Copyright (c) 2019 Henrik Bohlin
 * Full license text can be found in /LICENSE or at https://opensource.org/licenses/MIT.
 * ------------------------------------------------------------------------------------------ */
'use strict';
import * as vscode from 'vscode';
import * as path from 'path';
import {
    TestSuiteInfo,
    TestInfo,
    TestRunStartedEvent,
    TestRunFinishedEvent,
    TestSuiteEvent,
    TestEvent,
} from 'vscode-test-adapter-api';
import fs = require('fs');
import { ChildProcess, spawn } from 'child_process';
import kill = require('tree-kill');
import readline = require('readline');
import uuid = require('uuid-random');

const output = vscode.window.createOutputChannel('VUnit');

export async function getVunitVersion(): Promise<string> {
    return new Promise((resolve, reject) => {
        let version: string | undefined;
        runVunit(['--version'], (vunit: ChildProcess): void => {
            let proc: any = vunit;
            readline
                .createInterface({
                    input: proc.stdout,
                    terminal: false,
                })
                .on('line', (line: string) => {
                    version = line.trim();
                });
        })
            .then(() => {
                resolve(version);
            })
            .catch((err) => {
                reject(new Error(err));
            });
    });
}

export async function loadVunitTests(workDir: string): Promise<VunitData> {
    const vunit: VunitExportData = await getVunitData(workDir);
    const testSuite: TestSuiteInfo = {
        type: 'suite',
        id: 'vunit',
        label: 'VUnit',
        children: [],
    };
    let tbFiles: string[] = [];

    for (let test of vunit.tests) {
        let split = test.name.split('.');
        let libraryName = split[0];
        let testBenchName = split[1];
        let testCaseName = split.slice(2).join('.');

        let library:
            | TestSuiteInfo
            | TestInfo
            | undefined = testSuite.children.find((child) => {
            return child.id === libraryName;
        });
        if (!library) {
            library = {
                type: 'suite',
                id: libraryName,
                label: libraryName,
                children: [],
            };
            testSuite.children.push(library);
        }
        let testBench:
            | TestSuiteInfo
            | TestInfo
            | undefined = (library as TestSuiteInfo).children.find((child) => {
            return child.id === libraryName + '.' + testBenchName;
        });
        if (!testBench) {
            testBench = {
                type: 'suite',
                id: libraryName + '.' + testBenchName,
                label: testBenchName,
                children: [],
            };
            (library as TestSuiteInfo).children.push(testBench);
        }
        let testBenchFileName = test.location.file_name;
        if (!tbFiles.includes(testBenchFileName)) {
            tbFiles.push(testBenchFileName);
        }
        let testBenchSrc = fs.readFileSync(test.location.file_name, 'utf8');
        let testCase: TestInfo = {
            type: 'test',
            id: test.name,
            label: testCaseName,
            file: test.location.file_name,
            line:
                testBenchSrc.substr(0, test.location.offset).split(/\r?\n/)
                    .length - 1,
        };
        (testBench as TestSuiteInfo).children.push(testCase);
    }
    const flattenSingleLibrary: boolean =
        vscode.workspace.getConfiguration().get('vunit.flattenSingleLibrary') ||
        false;
    if (flattenSingleLibrary === true && testSuite.children.length === 1) {
        let library = testSuite.children[0];
        testSuite.children = [(library as TestSuiteInfo).children[0]];
        for (let testBench of testSuite.children) {
            testBench.label = library.label + '.' + testBench.label;
        }
    }
    let runPy = await getRunPy();
    let vunitData: VunitData = {
        runPy: runPy,
        testSuiteInfo: testSuite,
        testFiles: tbFiles,
    };

    return Promise.resolve<VunitData>(vunitData);
}

let vunitProcess: any;

export async function runVunitTests(
    tests: string[],
    testStatesEmitter: vscode.EventEmitter<
        TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent
    >,
    loadedTests: TestSuiteInfo
): Promise<void> {
    if (vunitProcess) {
        const msg = 'Unable to start test run, VUnit is already running';
        vscode.window.showErrorMessage(msg);
        return Promise.reject(new Error(msg));
    }
    let wsRoot = getWorkspaceRoot();
    if (!wsRoot) {
        const msg = 'Unable to start test run, no workspace folder open';
        vscode.window.showErrorMessage(msg);
        return Promise.reject(new Error(msg));
    }
    let testNames: string[] = [];
    output.appendLine(tests[0]);
    if (tests.length > 1 || tests[0] !== 'vunit') {
        for (const suiteOrTestId of tests) {
            const node = findNode(loadedTests, suiteOrTestId);
            if (node) {
                testNames.push(node.id + (node.type === 'suite' ? '.*' : ''));
            }
        }
    }

    let options = ['--no-color', '--exit-0'];
    const vunitOptions = vscode.workspace
        .getConfiguration()
        .get('vunit.options');
    if (vunitOptions) {
        options.push(vunitOptions as string);
    }
    if (testNames.length > 0) {
        options = options.concat(
            testNames.map((name: string) => {
                return '"' + name + '"';
            })
        );
    }
    await runVunit(options, (vunit: ChildProcess) => {
        vunitProcess = vunit;
        const testStart = /Starting (.*)/;
        const testEnd = /(pass|fail) \(.*\) (.*) \(.*\)/;
        readline
            .createInterface({
                input: vunitProcess.stdout,
                terminal: false,
            })
            .on('line', (line: string) => {
                let start = testStart.exec(line);
                if (start) {
                    testStatesEmitter.fire(<TestEvent>{
                        type: 'test',
                        test: start[1].trim(),
                        state: 'running',
                    });
                }
                let result = testEnd.exec(line);
                if (result) {
                    testStatesEmitter.fire(<TestEvent>{
                        type: 'test',
                        test: result[2].trim(),
                        state: result[1] === 'pass' ? 'passed' : 'failed',
                    });
                }
            });
    }).finally(() => {
        vunitProcess = null;
    });
}

export async function cancelRunVunitTests(): Promise<void> {
    if (vunitProcess) {
        kill(vunitProcess.pid);
    }
}

export async function runVunitTestInGui(
    testCaseId: string,
    loadedTests: TestSuiteInfo
): Promise<void> {
    let testCase = findNode(loadedTests, testCaseId);
    if (!testCase) {
        const msg = `Could not find test case with ID ${testCaseId}`;
        vscode.window.showErrorMessage(msg);
        return Promise.reject(new Error(msg));
    } else if (testCase.type !== 'test') {
        const msg = 'Selected item to run in GUI is not a test';
        vscode.window.showErrorMessage(msg);
        return Promise.reject(new Error(msg));
    }
    let options = ['--no-color', '--exit-0', '-g'];
    const vunitOptions = vscode.workspace
        .getConfiguration()
        .get('vunit.guiOptions');
    if (vunitOptions) {
        options.push(vunitOptions as string);
    }
    options.push('"' + testCaseId + '"');
    runVunit(options);
}

function findNode(
    searchNode: TestSuiteInfo | TestInfo,
    id: string
): TestSuiteInfo | TestInfo | undefined {
    if (searchNode.id === id) {
        return searchNode;
    } else if (searchNode.type === 'suite') {
        for (const child of searchNode.children) {
            const found = findNode(child, id);
            if (found) {
                return found;
            }
        }
    }
    return undefined;
}

function getWorkspaceRoot(): string | undefined {
    const workspaceFolder = (vscode.workspace.workspaceFolders || [])[0];
    let wsRoot: string | undefined = undefined;
    if (workspaceFolder) {
        wsRoot = workspaceFolder.uri.fsPath;
    }
    return wsRoot;
}

async function getVunitData(workDir: string): Promise<VunitExportData> {
    const vunitJson = path.join(workDir, `${uuid()}.json`);
    fs.mkdirSync(path.dirname(vunitJson), { recursive: true });
    let vunitData: VunitExportData = emptyVunitExportData;
    await runVunit(['--list', `--export-json ${vunitJson}`])
        .then(() => {
            vunitData = JSON.parse(fs.readFileSync(vunitJson, 'utf-8'));
            fs.unlinkSync(vunitJson);
        })
        .catch((err) => {
            vunitData = emptyVunitExportData;
        });
    return vunitData;
}

async function runVunit(
    vunitArgs: string[],
    vunitProcess: (vunit: ChildProcess) => void = () => {}
): Promise<string> {
    const runPy = await getRunPy();
    return new Promise((resolve, reject) => {
        if (!getWorkspaceRoot()) {
            return reject(new Error('Workspace root not defined.'));
        } else if (!runPy) {
            return reject(
                new Error('Unable to determine path of VUnit run script.')
            );
        } else if (!fs.existsSync(runPy)) {
            return reject(Error(`VUnit run script ${runPy} does not exist.`));
        }
        const python = vscode.workspace
            .getConfiguration()
            .get('vunit.python') as string;
        const args = [runPy].concat(vunitArgs);
        output.appendLine('');
        output.appendLine('===========================================');
        output.appendLine('Running VUnit: ' + python + ' ' + args.join(' '));
        let vunit = spawn(python, args, {
            cwd: path.dirname(runPy),
            shell: true,
        });
        vunit.on('close', (code) => {
            if (code === 0) {
                output.appendLine('\nFinished with exit code 0');
                resolve(code.toString());
            } else {
                let msg = `VUnit returned with non-zero exit code (${code}).`;
                output.appendLine('\n' + msg);
                reject(new Error(msg));
            }
        });
        vunitProcess(vunit);
        vunit.stdout.on('data', (data: string) => {
            output.append(data.toString());
        });
        vunit.stderr.on('data', (data: string) => {
            output.append(data.toString());
        });
    });
}

export async function findRunPy(
    workspaceFolder: vscode.WorkspaceFolder
): Promise<string[]> {
    let results = await vscode.workspace.findFiles(
        new vscode.RelativePattern(workspaceFolder, '**/run.py'),
        '**/{vunit,examples,acceptance/artificial}/{vhdl,verilog}'
    );
    let runPy: string[] = results.map((file) => {
        return file.fsPath;
    });
    return runPy;
}

async function getRunPy(): Promise<string> {
    return new Promise((resolve, reject) => {
        const workspaceFolder = (vscode.workspace.workspaceFolders || [])[0];
        if (!workspaceFolder) {
            return reject(
                new Error('No workspace folder open when getting run.py')
            );
        }

        const runPyConf = vscode.workspace
            .getConfiguration()
            .get('vunit.runpy');
        if (runPyConf) {
            resolve(path.join(workspaceFolder.uri.fsPath, runPyConf as string));
        } else if (vscode.workspace.getConfiguration().get('vunit.findRunPy')) {
            findRunPy(workspaceFolder).then((res) => {
                if (res.length === 0) {
                    reject(new Error('run.py not found or configured.'));
                } else if (res.length === 1) {
                    resolve(res[0]);
                } else {
                    reject(
                        new Error(
                            'Multiple run.py files found in workspace (' +
                                res.join(', ') +
                                ').'
                        )
                    );
                }
            });
        } else {
            reject('run.py not found');
        }
    });
}

export interface VunitData {
    runPy: string;
    testSuiteInfo: TestSuiteInfo;
    testFiles: string[];
}

interface VunitExportData {
    export_format_version: {
        major: number;
        minor: number;
        patch: number;
    };
    files: VunitFile[];
    tests: VunitTest[];
    [propName: string]: any;
}

const emptyVunitExportData: VunitExportData = {
    export_format_version: {
        major: 1,
        minor: 0,
        patch: 0,
    },
    files: [],
    tests: [],
};

interface VunitTest {
    attributes: {};
    location: {
        file_name: string;
        length: number;
        offset: number;
    };
    name: string;
    [propName: string]: any;
}

interface VunitFile {
    file_name: string;
    library_name: string;
    [propName: string]: any;
}
