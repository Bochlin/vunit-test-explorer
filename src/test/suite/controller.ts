import * as vscode from 'vscode';
import {
    TestAdapter,
    TestController,
    testExplorerExtensionId,
    TestHub,
    TestInfo,
    TestSuiteInfo,
} from 'vscode-test-adapter-api';
import { VUnitAdapter } from '../../adapter';

let controller: IntegrationTestController | undefined = undefined;

export async function getController(): Promise<TestAdapter> {
    if (!controller) {
        const testExplorerExtension = vscode.extensions.getExtension<TestHub>(
            testExplorerExtensionId
        );
        if (!testExplorerExtension) {
            throw new Error('Unable to initialize test explorer');
        }
        let testHub = testExplorerExtension.exports;
        controller = new IntegrationTestController();
        testHub.registerTestController(controller);
    }
    let vunit = await controller.getAdapter();
    return vunit;
}

/**
 * This class is intended as a starting point for implementing a "real" TestController.
 * The file `README.md` contains further instructions.
 */
class IntegrationTestController implements TestController {
    // here we collect subscriptions and other disposables that need
    // to be disposed when an adapter is unregistered
    private readonly disposables = new Map<
        TestAdapter,
        { dispose(): void }[]
    >();
    private adapter: TestAdapter | undefined = undefined;

    async getAdapter(): Promise<TestAdapter> {
        while (!this.adapter) {
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
        return this.adapter;
    }

    registerTestAdapter(adapter: TestAdapter): void {
        this.adapter = adapter;
        const adapterDisposables: { dispose(): void }[] = [];
        this.disposables.set(adapter, adapterDisposables);

        // adapterDisposables.push(
        //     adapter.tests((testLoadEvent) => {
        //         if (testLoadEvent.type === 'started') {
        //             console.log('Loading tests.........');
        //         } else {
        //             // testLoadEvent.type === 'finished'
        //             const rootSuite = testLoadEvent.suite;
        //             const testCount = rootSuite ? countTests(rootSuite) : 0;
        //             console.log(`Loaded ${testCount} tests`);
        //         }
        //     })
        // );

        // adapterDisposables.push(
        //     adapter.testStates((testRunEvent) => {
        //         if (testRunEvent.type === 'started') {
        //             this.statusBarItem.text = 'Running tests: ...';
        //             this.passedTests = 0;
        //             this.failedTests = 0;
        //         } else if (testRunEvent.type === 'test') {
        //             if (testRunEvent.state === 'passed') {
        //                 this.passedTests++;
        //             } else if (testRunEvent.state === 'failed') {
        //                 this.failedTests++;
        //             }

        //             this.statusBarItem.text = `Running tests: ${this.passedTests} passed / ${this.failedTests} failed`;
        //         } else if (testRunEvent.type === 'finished') {
        //             this.statusBarItem.text = `Tests: ${this.passedTests} passed / ${this.failedTests} failed`;
        //         }
        //     })
        // );
    }

    unregisterTestAdapter(adapter: TestAdapter): void {
        const adapterDisposables = this.disposables.get(adapter);
        if (adapterDisposables) {
            for (const disposable of adapterDisposables) {
                disposable.dispose();
            }

            this.disposables.delete(adapter);
        }
    }
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
