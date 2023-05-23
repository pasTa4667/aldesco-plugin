import * as vscode from 'vscode';
import * as path from 'path';
/**
 * Manages react webview panels
 */
export default class ReactPanel {
	/**
	 * Track the currently panel. Only allow a single panel to exist at a time.
	 */
	public static currentPanel: ReactPanel | undefined;

	private static readonly viewType = 'react';

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionPath: string;
	private _disposables: vscode.Disposable[] = [];

	public static createOrShow(extensionPath: string): ReactPanel {
		const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

		// If we already have a panel, show it.
		// Otherwise, create a new panel.
		if (ReactPanel.currentPanel) {
			ReactPanel.currentPanel._panel.reveal(column);
			return ReactPanel.currentPanel;
		} else {
			ReactPanel.currentPanel = new ReactPanel(extensionPath, column || vscode.ViewColumn.One);
			return ReactPanel.currentPanel;
		}
	}

	public static createOrShowLH(extensionPath: string): ReactPanel {
		const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

		// If we already have a panel, show it.
		// Otherwise, create a new panel.
		if (ReactPanel.currentPanel) {
			ReactPanel.currentPanel._panel.reveal(column);
			return ReactPanel.currentPanel;
		} else {
			ReactPanel.currentPanel = new ReactPanel(extensionPath, column || vscode.ViewColumn.One, true);
			return ReactPanel.currentPanel;
		}
	}

	private constructor(extensionPath: string, column: vscode.ViewColumn, lh?: boolean) {
		this._extensionPath = extensionPath;

		// Create and show a new webview panel
		this._panel = vscode.window.createWebviewPanel(ReactPanel.viewType, "React", column, {
			// Enable javascript in the webview
			enableScripts: true,

			// And restric the webview to only loading content from our visualizer build folder
			// localResourceRoots: [
			// 	vscode.Uri.file(path.join(this._extensionPath, 'visualizer_dist'))
			// ]
		});

		// Set the webview's initial html content 
		lh ? this._panel.webview.html = this._getHtmlForWebviewLH() : this._panel.webview.html = this._getHtmlForWebview();

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(message => {
			console.log('message received in vsc', message.type);
			switch (message.type) {
				case 'alert':
					vscode.window.showErrorMessage(message.text);
					return;
				case 'VSCtest':
					console.log('right message received in vsc', message.message);
					return;
				default:
					console.log('wrong received in vsc');
					return;
			}
		}, null, this._disposables);
	}

	public sendMessage(type: string, message: any) {
		this._panel.webview.postMessage({ type: type, message: message });
	}

	public dispose() {
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

	private _getHtmlForWebview() {
		const manifest = require(path.join(this._extensionPath, 'visualizer', 'dist', 'asset-manifest.json'));
		const mainScript = manifest['files']['main.js'];
		const icon = manifest['files']['favicon.png'];

		const scriptPathOnDisk = vscode.Uri.file(path.join(this._extensionPath, 'visualizer', 'dist', mainScript));
		const iconPathOnDisk = vscode.Uri.file(path.join(this._extensionPath, 'visualizer', 'dist', icon));

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

	private _getHtmlForWebviewLH() {
		return `<html>
		<head>
			<style>
			html, body {
				margin: 0;
				padding: 0;
				height: 100%;
				overflow: hidden;
			}

			iframe {
				width: 100%;
				height: 100%;
				border: none;
			}
			</style>
		</head>
		<body>
			<iframe src="http://localhost:8080" sandbox="allow-scripts allow-same-origin allow-popups"></iframe>
		</body>
		</html>`;
	}
}
