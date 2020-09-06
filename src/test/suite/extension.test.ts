/* ------------------------------------------------------------------------------------------
 * MIT License
 * Copyright (c) 2020 Henrik Bohlin
 * Full license text can be found in /LICENSE or at https://opensource.org/licenses/MIT.
 * ------------------------------------------------------------------------------------------ */

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import * as vunit from '../../vunit';
import { execSync } from 'child_process';
import { TestSuiteInfo, TestInfo } from 'vscode-test-adapter-api';
import { getController } from './controller';

suite('Extension Test Suite', async () => {
    vscode.window.showInformationMessage('Start all tests.');
    const workspaceFolder = (vscode.workspace.workspaceFolders || [])[0];

    test('Get VUnit version', async () => {
        const runPy = path.join(
            workspaceFolder.uri.fsPath,
            'folder with spaces/run.py'
        );
        let expected_version = execSync(`python "${runPy}" --version`)
            .toString()
            .trim();
        let version = await vunit.getVunitVersion();
        assert.equal(version, expected_version);
    });

    test('Load tests', async () => {
        let rootSuite = await loadRootSuite();
        const testCount = rootSuite ? countTests(rootSuite) : 0;
        assert.equal(testCount, 13);
    });

    test('Run all tests', async () => {
        await runTests(['vunit'], 11, 2);
    }).timeout(20000);

    test('Run test bench', async () => {
        await runTests(['testlib.tb_test0'], 2, 1);
    }).timeout(20000);

    test('Run two separate test cases', async () => {
        await runTests(
            ['testlib2.tb_test2.test 3', 'testlib.tb_test1.tbconf.test2'],
            1,
            1
        );
    }).timeout(20000);
});

async function setWorkspaceSetting(section: string, setting: any) {
    const config = vscode.workspace.getConfiguration();
    await config.update(
        section,
        setting,
        false
    );
   }

async function loadRootSuite(): Promise<TestSuiteInfo> {
    const adapter = await getController();
    return new Promise<TestSuiteInfo>((resolve, reject) => {
        let loadListener = adapter.tests((testLoadEvent) => {
            if (testLoadEvent.type === 'finished') {
                loadListener.dispose();
                const _rootSuite = testLoadEvent.suite;
                if (_rootSuite) {
                    resolve(_rootSuite);
                } else {
                    reject();
                }
            }
        });
        adapter.load();
    });
}

async function runTests(
    tests: string[],
    expectedPass: number,
    expectedFail: number
) {
    await loadRootSuite();
    let passed = 0;
    let failed = 0;
    const adapter = await getController();
    let testListener = adapter.testStates((testRunEvent) => {
        if (testRunEvent.type === 'test') {
            if (testRunEvent.state === 'passed') {
                passed++;
            } else if (testRunEvent.state === 'failed') {
                failed++;
            }
        } else if (testRunEvent.type === 'finished') {
            testListener.dispose();
        }
    });
    await adapter.run(tests);
    assert.equal(
        passed,
        expectedPass,
        'Unexpected number of passed VUnit tests'
    );
    assert.equal(
        failed,
        expectedFail,
        'Unexpected number of failed VUnit tests'
    );
}

function countTests(info: TestSuiteInfo | TestInfo): number {
    if (info.type === 'suite') {
        let total = 0;
        for (const child of info.children) {
            total += countTests(child);
        }
        return total;
    } else {
        // info.type === 'test'
        return 1;
    }
}
