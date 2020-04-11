import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as vunit from '../../vunit';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Get version', async () => {
        let version = await vunit.getVunitVersion();
        let expected_version = process.env.VUNIT_VERSION || '4.3.0';
        assert.equal(version, expected_version);
    });
});
