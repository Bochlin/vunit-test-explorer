import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import * as vunit from '../../vunit';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Get version', async () => {
        console.log(process.cwd());
        const workspaceFolder = (vscode.workspace.workspaceFolders || [])[0];
        const runPy = path.join(workspaceFolder.uri.fsPath, 'run.py');
        const { exec } = require('child_process');
        let expected_version = 'Failed to get expected version';
        await exec(
            `python ${runPy} --version`,
            async (err: any, stdout: any, stderr: any) => {
                if (err) {
                    console.error(err);
                } else {
                    console.log(`stdout: ${stdout}`);
                    console.log(`stderr: ${stderr}`);
                    expected_version = stdout.toString().trim();
                }
            }
        );
        let version = await vunit.getVunitVersion();
        assert.equal(version, expected_version);
    });
});
