import * as vscode from 'vscode';
import * as path from 'path';

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

	//message list to keep track of not acknowledged messages
	private _messageList : {type: string}[] = [];

	public static createOrShow(extensionPath: string, fileName?: string): Promise<ReactPanel> {
		return new Promise<ReactPanel>((resolve) => {
			const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;
	
			// If we already have a panel, show it.
			// Otherwise, create a new panel.
			if (ReactPanel.currentReactPanel) {
				ReactPanel.currentReactPanel._panel.reveal(column);
				resolve(ReactPanel.currentReactPanel);
			} else {
				ReactPanel.currentReactPanel = new ReactPanel(extensionPath, column || vscode.ViewColumn.One, undefined, fileName ? fileName : '');
				resolve(ReactPanel.currentReactPanel);
			}
		})
	}

	public duplicateActive(extensionPath: string): ReactPanel | undefined {
		const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

		if (ReactPanel._activePanel) {

			if (!ReactPanel._activePanel.group) {
				ReactPanel._activePanel.group = ReactPanel._group++;
				this.sendMessage('VSC:SetGroup', { group: ReactPanel._activePanel.group, join: false });
			}

			ReactPanel.currentReactPanel = new ReactPanel(extensionPath, column || vscode.ViewColumn.One, ReactPanel._activePanel.group);
			return ReactPanel.currentReactPanel;
		}

		return;
	}

	private constructor(extensionPath: string, column: vscode.ViewColumn, group?: number, fileName?: string) {
		this._extensionPath = extensionPath;
		const idGenerator = this.idGenerator();
		const id = idGenerator.next().value;

		// Create and show a new webview panel
		this._panel = vscode.window.createWebviewPanel(ReactPanel.viewType, fileName ? fileName : 'Visualizer ' + id, column, {
			// Enable javascript in the webview
			enableScripts: true,
			// To stop the webview from closing, when not active
			retainContextWhenHidden: true,
		});

		const newPanel = { panel: this._panel, id: id, group: group ? group : undefined };
		ReactPanel._panels.push(newPanel);
		ReactPanel._activePanel = newPanel;

		//to receive an Ack when the visualizer has fully started
		this._messageList.push({type: 'Started'});

		// Set the webview's initial html content 
		this._panel.webview.html = this._getHtmlForWebview();
		
		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
		
		this._panel.onDidChangeViewState(() => {
			if (this._panel.active) {
				ReactPanel._activePanel.panel = this._panel;
			}
		})

		this._panel.webview.onDidReceiveMessage((event) => {
			console.log('received in ReactPanel');
			//not needed
		});
		
		if (group) {
			setTimeout(() => {
				this.sendMessage('VSC:SetGroup', { group: group, join: true });
			}, 1000); 
		}
		console.log("new panel: ", newPanel.id, newPanel.group);
	}
	
	public sendMessage(type: string, message: any) {
		console.log("vsc: message send", type);
		this._panel.webview.postMessage({ type: type, message: message });
	}

	public sendMessageWithAck(type: string, message: any):Promise<boolean> {
		return new Promise<boolean>(async (res) => {
			console.log("vsc: message send with Ack", type);
			this._panel.webview.postMessage({ type: type, message: message });
			this._messageList.push({type: type});

			await this.messageReceived(type) ? res(true) : res(false);
		})
	}

	private messageReceived(type:string){
		return new Promise<boolean>(async (res) => {
			//we give it 5 seconds until the message times out
			const timeout = 5000;
			const startTime = Date.now();

			//wait until the messageList doesnt contain the message anymore
			while (this._messageList.some((item) => item.type === type)) {
				if (Date.now() - startTime > timeout) {
					res(false);
					console.log('message resolved false')
					return;
				}
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
			res(true);
		})
	}

	private acknowledgeMessage(type: string){
		const index = this._messageList.findIndex((item) => item.type === type);
		if(index !== -1){
			this._messageList.splice(index);
		}
	}

	private broadcastMessage(type: string, message: any) {
		const senderGroup = ReactPanel._activePanel.group;
		ReactPanel._panels.forEach((wvdata) => {
			if (wvdata.group === senderGroup) {
				wvdata.panel?.webview.postMessage({ type: type, message: message })
			}
		})
	}

	public changeTitle(newTitle: string) {
		const senderGroup = ReactPanel._activePanel.group;
		ReactPanel._panels.forEach((wvdata) => {
			if (wvdata.group === senderGroup && newTitle && wvdata.panel) {
				wvdata.panel!.title = newTitle;
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

		return `<!doctype html>
		<html>
		<head>
		<meta charset="utf-8"><title>AST Prototype Visualizer</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="${iconUri}">
		<meta http-equiv="Content-Security-Policy" default-src *  data: blob: filesystem: about: ws: wss: 'unsafe-inline' 'unsafe-eval' 'unsafe-dynamic'; 
													script-src * data: blob: 'unsafe-inline' 'unsafe-eval'; 
													connect-src * data: blob: 'unsafe-inline'; 
													img-src * data: blob: 'unsafe-inline'; 
													frame-src * data: blob: ; 
													style-src * data: blob: 'unsafe-inline';
													font-src * data: blob: 'unsafe-inline';
													frame-ancestors * data: blob: 'unsafe-inline';>
		<link rel="stylesheet" href=${cssUri}>
		</head>
		<body class=${colorScheme}>
		<script defer="defer" src="${scriptUri}"></script>
		<script> 
			(function() {
				const vscode = acquireVsCodeApi();	
				window.addEventListener("message", (event) => {
					const { type, message } = event.data;
					if(type === "Ack"){
						console.log('Ack received');
						vscode.postMessage("Ack");
						${this.acknowledgeMessage('Ack')};
					}else if(type === "Started"){
						vscode.postMessage("Started");
						console.log('Started received');
						${this.acknowledgeMessage('Started')};
					}
				})
			}())
		</script>
		</body>
		</html>`;
	}

}
