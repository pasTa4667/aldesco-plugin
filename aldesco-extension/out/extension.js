"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const path = require("path");
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
function activate(context) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('extension "aldesco-extension" is now active!');
    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand('aldesco-extension.visualizer', () => {
        ReactPanel.createOrShow(context.extensionPath);
    });
    context.subscriptions.push(disposable);
}
exports.activate = activate;
// This method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
/**
 * Manages react webview panels
 */
class ReactPanel {
    static createOrShow(extensionPath) {
        const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;
        // If we already have a panel, show it.
        // Otherwise, create a new panel.
        if (ReactPanel.currentPanel) {
            ReactPanel.currentPanel._panel.reveal(column);
        }
        else {
            ReactPanel.currentPanel = new ReactPanel(extensionPath, column || vscode.ViewColumn.One);
        }
    }
    constructor(extensionPath, column) {
        this._disposables = [];
        this._extensionPath = extensionPath;
        // Create and show a new webview panel
        this._panel = vscode.window.createWebviewPanel(ReactPanel.viewType, "React", column, {
            // Enable javascript in the webview
            enableScripts: true,
            // And restric the webview to only loading content from our extension's `media` directory.
            localResourceRoots: [
                vscode.Uri.file(path.join(this._extensionPath, 'build'))
            ]
        });
        // Set the webview's initial html content 
        this._panel.webview.html = this._getHtmlForWebview();
        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'alert':
                    vscode.window.showErrorMessage(message.text);
                    return;
            }
        }, null, this._disposables);
    }
    doRefactor() {
        // Send a message to the webview webview.
        // You can send any JSON serializable data.
        this._panel.webview.postMessage({ command: 'refactor' });
    }
    dispose() {
        ReactPanel.currentPanel = undefined;
        // Clean up our resources
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
    _getHtmlForWebview() {
        const manifest = require(path.join(this._extensionPath, 'build', 'asset-manifest.json'));
        const mainScript = manifest['files']['main.js'];
        const icon = manifest['files']['favicon.png'];
        const scriptPathOnDisk = vscode.Uri.file(path.join(this._extensionPath, 'build', mainScript));
        const iconPathOnDisk = vscode.Uri.file(path.join(this._extensionPath, 'build', icon));
        const scriptUri = this._panel.webview.asWebviewUri(scriptPathOnDisk);
        const iconUri = this._panel.webview.asWebviewUri(iconPathOnDisk);
        return `<!doctype html>
		<html>
		<head>
		<meta charset="utf-8"><title>AST Prototype Visualizer</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="${iconUri}">
		<script defer="defer" src="${scriptUri}"></script>
		</head>
		<body></body>
		</html>`;
    }
}
ReactPanel.viewType = 'react';
function getNonce() {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
//# sourceMappingURL=extension.js.map