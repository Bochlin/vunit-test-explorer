# VUnit Test Explorer (preview)

Run your [VUnit](https://vunit.github.io/) tests from the Sidebar of Visual Studio Code.

![UI example](/img/screenshot.png?raw=true)

# Configuration

The following configuration properties are available:

Property                              | Description
--------------------------------------|---------------------------------------------------------------
`vunit.runpy`                         | Path to VUnit python script (run.py) relative to workspace folder.
`vunit.findRunPy`                     | Detect run.py automatically within workspace.
`vunit.watch`                         | Watch run.py and test bench files for changes and reload tests automatically.
`vunit.python`                        | Path to python executable.
`vunit.flattenSingleLibrary`          | Flatten library hierarchy in explorer when all tests are contained within a single library.
`vunit.options`                       | VUnit run.py command line options when running tests.
`vunit.guiOptions`                    | VUnit run.py command line options when running GUI (-g should not be added here).
`testExplorer.onStart`                | Retire or reset all test states whenever a test run is started
`testExplorer.onReload`               | Retire or reset all test states whenever the test tree is reloaded
`testExplorer.codeLens`               | Show a CodeLens above each test or suite for running or debugging the tests
`testExplorer.gutterDecoration`       | Show the state of each test in the editor using Gutter Decorations
`testExplorer.errorDecoration`        | Show error messages from test failures as decorations in the editor
`testExplorer.errorDecorationHover`   | Provide hover messages for the error decorations in the editor
`testExplorer.sort`                   | Sort the tests and suites by label or location. If this is not set (or set to null), they will be shown in the order that they were received from the adapter
`testExplorer.showCollapseButton`     | Show a button for collapsing the nodes of the test tree
`testExplorer.showExpandButton`       | Show a button for expanding the top nodes of the test tree, recursively for the given number of levels
`testExplorer.showOnRun`              | Switch to the Test Explorer view whenever a test run is started
`testExplorer.addToEditorContextMenu` | Add menu items for running and debugging the tests in the current file to the editor context menu
`testExplorer.mergeSuites`            | Merge suites with the same label and parent
`testExplorer.hideEmptyLog`           | Hide the output channel used to show a test's log when the user clicks on a test whose log is empty

# Commands

The following commands are available in VS Code's command palette, use the ID to add them to your keyboard shortcuts:

ID                                   | Command
-------------------------------------|--------------------------------------------
`test-explorer.reload`               | Reload tests
`test-explorer.run-all`              | Run all tests
`test-explorer.run-file`             | Run tests in current file
`test-explorer.run-test-at-cursor`   | Run the test at the current cursor position
`test-explorer.rerun`                | Repeat the last test run
`test-explorer.debug-test-at-cursor` | Debug the test at the current cursor position
`test-explorer.redebug`              | Repeat the last test run in the debugger
`test-explorer.cancel`               | Cancel running tests

# Dependencies

This extension uses the [Test Explorer for Visual Studio Code](https://github.com/hbenl/vscode-test-explorer) extension published under the MIT license.