import * as vscode from 'vscode';
import * as path from 'path';
import { rejects } from 'assert';

interface WebviewData {
	panel?: vscode.WebviewPanel;
	id: number;
	group?: number;
}

/**
 * Manages react webview panels
 */
export default class ReactPanel {

	public static currentReactPanel: ReactPanel | undefined;

	private static readonly viewType = 'visualizer';
	private static _panels: WebviewData[] = [];
	private static _idStart = 1;
	private static _group = 1;

	//to keep track of the last used webview
	private static _activePanel: WebviewData = { panel: undefined, id: 0 };

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionPath: string;
	private _disposables: vscode.Disposable[] = [];
	private readonly _configuration = vscode.workspace.getConfiguration('aldesco-extension');


	public static createOrShow(extensionPath: string): ReactPanel {
		const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

		// If we already have a panel, show it.
		// Otherwise, create a new panel.
		if (ReactPanel.currentReactPanel) {
			ReactPanel.currentReactPanel._panel.reveal(column);
			return ReactPanel.currentReactPanel;
		} else {
			ReactPanel.currentReactPanel = new ReactPanel(extensionPath, column || vscode.ViewColumn.One);
			return ReactPanel.currentReactPanel;
		}
	}

	public static createOrShowLH(extensionPath: string): ReactPanel {
		const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

		// If we already have a panel, show it.
		// Otherwise, create a new panel.
		if (ReactPanel.currentReactPanel) {
			ReactPanel.currentReactPanel._panel.reveal(column);
			return ReactPanel.currentReactPanel;
		} else {
			ReactPanel.currentReactPanel = new ReactPanel(extensionPath, column || vscode.ViewColumn.One, true);
			return ReactPanel.currentReactPanel;
		}
	}

	public duplicateActive(extensionPath: string): ReactPanel | undefined {
		const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

		if (ReactPanel._activePanel) {

			if (!ReactPanel._activePanel.group) {
				ReactPanel._activePanel.group = ReactPanel._group++;
			}

			ReactPanel.currentReactPanel = new ReactPanel(extensionPath, column || vscode.ViewColumn.One, false, ReactPanel._activePanel.group);
			return ReactPanel.currentReactPanel;
		}

		return;
	}

	private constructor(extensionPath: string, column: vscode.ViewColumn, lh?: boolean, group?: number) {
		this._extensionPath = extensionPath;
		const idGenerator = this.idGenerator();
		const id = idGenerator.next().value;

		// Create and show a new webview panel
		this._panel = vscode.window.createWebviewPanel(ReactPanel.viewType, "Visualizer " + id, column, {
			// Enable javascript in the webview
			enableScripts: true,
			// To stop the webview from closing, when not active
			retainContextWhenHidden: true,
			// And restric the webview to only loading content from our visualizer build folder
			// localResourceRoots: [
			// 	vscode.Uri.file(path.join(this._extensionPath, 'visualizer', 'dist'))
			// ],
		});

		const newPanel = { panel: this._panel, id: id, group: group ? group : undefined };
		ReactPanel._panels.push(newPanel);
		ReactPanel._activePanel = newPanel;

		if (group) {
			this.broadcastMessage('VSC:SetGroup', group);
		}
		console.log("new panel: ", newPanel.id, newPanel.group);

		// Set the webview's initial html content 
		lh ? this._panel.webview.html = this._getHtmlForWebviewLH() : this._panel.webview.html = this._getHtmlForWebview();

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Handle messages from the webview not working for some reason
		this._panel.webview.onDidReceiveMessage(message => {
			console.log('vsc: message received', message.type);
			switch (message.type) {
				case 'alert':
					vscode.window.showErrorMessage(message.text);
					return;
				case 'VSCtest':
					console.log('vsc: test received', message.message);
					return;
				default:
					console.log('vsc: default received');
					return;
			}
		}, null, this._disposables);

		this._panel.onDidDispose(() => {
			this._panel.dispose();
		})

		this._panel.onDidChangeViewState(() => {
			if (this._panel.active) {
				ReactPanel._activePanel.panel = this._panel;
			}
		})
	}

	public sendMessage(type: string, message: any) {
		console.log("vsc: message send");
		this._panel.webview.postMessage({ type: type, message: message });
	}

	public sendMessageAsync(type: string, message: any): Promise<void> {
		return new Promise((resolve, rejects) => {
			if (this._panel) {
				console.log("vsc: message send async");
				this._panel.webview.postMessage({ type: type, message: message });
				resolve();
			} else {
				rejects();
			}
		})
	}

	private broadcastMessage(type: string, message: any) {
		const senderGroup = ReactPanel._activePanel.group;
		ReactPanel._panels.forEach((wvdata) => {
			if (wvdata.group === senderGroup) {
				wvdata.panel?.webview.postMessage({ type: type, message: message })
			}
		})
	}

	public dispose() {
		ReactPanel.currentReactPanel = undefined;

		// Clean up our resources
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private * idGenerator(): Generator<number> {
		while (true) {
			yield ReactPanel._idStart++;
		}
	}

	private _getHtmlForWebview() {
		const manifest = require(path.join(this._extensionPath, 'visualizer', 'dist', 'asset-manifest.json'));
		const mainScript = manifest['files']['main.js'];
		const icon = manifest['files']['favicon.png'];

		const scriptPathOnDisk = vscode.Uri.file(path.join(this._extensionPath, 'visualizer', 'dist', mainScript));
		const iconPathOnDisk = vscode.Uri.file(path.join(this._extensionPath, 'visualizer', 'dist', icon));

		const cssPathOnDisk = vscode.Uri.file(path.join(this._extensionPath, 'src', 'media', 'webview.css'));

		const cssUri = this._panel.webview.asWebviewUri(cssPathOnDisk);
		const scriptUri = this._panel.webview.asWebviewUri(scriptPathOnDisk);
		const iconUri = this._panel.webview.asWebviewUri(iconPathOnDisk);

		const enableDarkMode = this._configuration.get('visualizer.enableDarkMode');
		const colorScheme = enableDarkMode ? 'dark-mode' : 'light-mode';
		console.log(colorScheme);

		return `<!doctype html>
		<html>
		<head>
		<meta charset="utf-8"><title>AST Prototype Visualizer</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="${iconUri}">
		<meta http-equiv="Content-Security-Policy" content="default-src *; script-src 'unsafe-inline' 'unsafe-eval' *; style-src 'unsafe-inline' *; img-src *; font-src * data:">
		<link rel="stylesheet" href=${cssUri}>
		<script defer="defer" src="${scriptUri}"></script>
		</head>
		<body class=${colorScheme}></body>
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
