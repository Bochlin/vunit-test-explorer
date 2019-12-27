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

const output = vscode.window.createOutputChannel('VUnit');

export async function getVunitVersion(): Promise<string> {
    return new Promise((resolve, reject) => {
        let version: string | undefined;
        runVunit(['--version'], (vunit: ChildProcess): void => {
            vunitProcess = vunit;
            readline
                .createInterface({
                    input: vunitProcess.stdout,
                    terminal: false,
                })
                .on('line', (line: string) => {
                    version = line.trim();
                    output.appendLine(`Found VUnit version ${version}`);
                });
        })
            .then(() => {
                resolve(version);
            })
            .catch(err => {
                reject(new Error(err));
            });
    });
}

export async function loadVunitTests(workDir: string): Promise<TestSuiteInfo> {
    const vunit: VunitData = await getVunitData(workDir);
    const testSuite: TestSuiteInfo = {
        type: 'suite',
        id: 'root',
        label: 'VUnit',
        children: [],
    };

    for (let test of vunit.tests) {
        let split = test.name.split('.');
        let libraryName = split[0];
        let testBenchName = split[1];
        let testCaseName = split.slice(2).join('.');

        let library:
            | TestSuiteInfo
            | TestInfo
            | undefined = testSuite.children.find(child => {
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
            | undefined = (library as TestSuiteInfo).children.find(child => {
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
    const flattenSingleLibrary = vscode.workspace
        .getConfiguration()
        .get('vunit.flattenSingleLibrary');
    if (flattenSingleLibrary == true && testSuite.children.length == 1) {
        let library = testSuite.children[0];
        testSuite.children = [(library as TestSuiteInfo).children[0]];
        for (let testBench of testSuite.children) {
            testBench.label = library.label + '.' + testBench.label;
        }
    }
    return Promise.resolve<TestSuiteInfo>(testSuite);
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
        throw new Error(msg);
    }
    let wsRoot = getWorkspaceRoot();
    if (!wsRoot) {
        const msg = 'Unable to start test run, no workspace folder open';
        vscode.window.showErrorMessage(msg);
        throw new Error(msg);
    }
    let testNames: string[] = [];
    if (tests.length == 1 && tests[0] == 'root') {
        testNames.push('*');
    } else {
        for (const suiteOrTestId of tests) {
            const node = findNode(loadedTests, suiteOrTestId);
            if (node) {
                testNames.push(node.id + (node.type === 'suite' ? '.*' : ''));
            }
        }
    }
    function checkTestResults(vunit: ChildProcess): void {
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
    }
    let options = ['--exit-0'];
    const vunitOptions = vscode.workspace
        .getConfiguration()
        .get('vunit.options');
    if (vunitOptions) {
        options.concat(vunitOptions as string);
    }
    options.concat(testNames);
    await runVunit(options, checkTestResults)
        .catch(err => {
            output.appendLine(err.toString());
        })
        .finally(() => {
            vunitProcess = null;
        });
}

export async function cancelRunVunitTests(): Promise<void> {
    output.appendLine('Canceling tests...');
    if (vunitProcess) {
        kill(vunitProcess.pid);
    }
}

export async function runVunitTestsInGui(
    tests: string[],
    loadedTests: TestSuiteInfo
): Promise<void> {
    if (tests.length > 1) {
        vscode.window.showWarningMessage(
            'Multiple test cases selected, only the first will be run in GUI.'
        );
    }
    let testCaseId = tests[0];
    let testCase = findNode(loadedTests, testCaseId);
    if (!testCase) {
        const msg = `Could not find test case with ID ${testCaseId}`;
        vscode.window.showErrorMessage(msg);
        throw new Error(msg);
    } else if (testCase.type !== 'test') {
        const msg = 'Selected item to run in GUI is not a test';
        vscode.window.showErrorMessage(msg);
        throw new Error(msg);
    }
    let msg = `Starting ${testCaseId} in GUI`;
    vscode.window.showInformationMessage(msg);
    output.appendLine(msg);
    let options = ['--exit-0', '-g'];
    const vunitOptions = vscode.workspace
        .getConfiguration()
        .get('vunit.guiOptions');
    if (vunitOptions) {
        options.concat(vunitOptions as string);
    }
    options.concat(testCaseId);
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
            if (found) return found;
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

async function getVunitData(workDir: string): Promise<VunitData> {
    let vunitData: VunitData = emptyVunitData;
    const vunitJson = path.join(workDir, 'vunit.json');
    output.appendLine('Exporting json data from VUnit...');
    await runVunit(['--list', `--export-json ${vunitJson}`])
        .then(() => {
            vunitData = JSON.parse(fs.readFileSync(vunitJson, 'utf-8'));
        })
        .catch(err => {
            output.appendLine(err);
            vunitData = emptyVunitData;
        });
    output.appendLine('Finished exporting json data from VUnit');
    return vunitData;
}

async function runVunit(
    vunitArgs: string[],
    vunitProcess: (vunit: ChildProcess) => void = () => {}
): Promise<string> {
    return new Promise((resolve, reject) => {
        const runPy = getRunPy();
        if (!getWorkspaceRoot()) {
            throw new Error('Workspace root not defined.');
        } else if (!runPy) {
            throw new Error('Unable to determine path of VUnit run script.');
        } else if (!fs.existsSync(runPy)) {
            throw new Error(`VUnit run script ${runPy} does not exist.`);
        }
        const python = vscode.workspace
            .getConfiguration()
            .get('vunit.python') as string;
        const args = [runPy].concat(vunitArgs);
        output.appendLine(python + ' ' + args.join(' '));
        let vunit = spawn(python, args, { cwd: getWorkspaceRoot() });
        vunit.on('close', (code: string) => {
            output.appendLine(`VUnit exited with code ${code}`);
            if (code == '0') {
                resolve(code);
            } else {
                reject(new Error('VUnit returned with non-zero exit code.'));
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

function getRunPy(): string | undefined {
    const wsRoot = getWorkspaceRoot();
    const runPyConf = vscode.workspace.getConfiguration().get('vunit.runpy');
    if (wsRoot && runPyConf) {
        return path.join(wsRoot, runPyConf as string);
    } else {
        return undefined;
    }
}

interface VunitData {
    export_format_version: {
        major: number;
        minor: number;
        patch: number;
    };
    files: VunitFile[];
    tests: VunitTest[];
    [propName: string]: any;
}

const emptyVunitData: VunitData = {
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
