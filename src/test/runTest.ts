import * as cp from 'child_process';
import * as path from 'path';

import {
    runTests,
    downloadAndUnzipVSCode,
    resolveCliPathFromVSCodeExecutablePath,
} from 'vscode-test';

async function main() {
    try {
        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // The path to test runner
        // Passed to --extensionTestsPath
        const extensionTestsPath = path.resolve(__dirname, './suite/index');

        // Path to test project
        const testWorkspace = path.resolve(
            extensionDevelopmentPath,
            './src/test/workspaces/ws1'
        );

        // Test environment
        // Use cp.spawn / cp.exec for custom setup
        const vscodeExecutablePath = await downloadAndUnzipVSCode('stable');
        const cliPath = resolveCliPathFromVSCodeExecutablePath(
            vscodeExecutablePath
        );
        cp.spawnSync(
            cliPath,
            ['--install-extension', 'hbenl.vscode-test-explorer'],
            {
                encoding: 'utf-8',
                stdio: 'inherit',
            }
        );
        console.log(testWorkspace);
        // Download VS Code, unzip it and run the integration test
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [testWorkspace],
        });
    } catch (err) {
        console.error('Failed to run tests');
        process.exit(1);
    }
}

main();
