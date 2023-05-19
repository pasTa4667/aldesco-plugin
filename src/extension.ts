// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import ReactPanel from './reactPanel';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('extension "aldesco-extension" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json

	let reactPanel: ReactPanel | undefined;
	let basename: string;
	let fileContent: string;

	//Opens Visualizer without json
	let disposableVis = vscode.commands.registerCommand('aldesco-extension.visualizer', () => {
		reactPanel = ReactPanel.createOrShow(context.extensionPath);
	});

	//opens Visualizer with json (right click on json file)
	let disposableVisWithJson = vscode.commands.registerCommand('aldesco-extension.rightClickLogFile', (fileUri: vscode.Uri) => {
		basename = path.posix.basename(fileUri.path);
		fileContent = fs.readFileSync(fileUri.fsPath, 'utf8');

		reactPanel = ReactPanel.createOrShow(context.extensionPath);

		if (reactPanel && basename && fileContent) {
			console.log('opening json');
			reactPanel.sendMessage('VSCtest', { name: basename, content: fileContent });
		}
	});

	//connect to visualizer via url (locally start visualizer first) (mainly for easier debugging)
	let disposableVisLH = vscode.commands.registerCommand('aldesco-extension.connectToVisLH', () => {
		reactPanel = ReactPanel.createOrShowLH(context.extensionPath);
	});


	//open json file in Visualizer
	let disposabelOpenJsonInVis = vscode.commands.registerCommand('aldesco-extension.openJsonInVis', () => {

		const activeEditor = vscode.window.activeTextEditor;

		if (!activeEditor || !activeEditor.document.fileName.includes('vis')) {
			//TODO: only be able to select log files
			vscode.window.showOpenDialog({
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: false,
				filters: {
					'AllFiles': ['*']
				}
			}).then(fileUris => {
				if (fileUris && fileUris[0]) {
					const fileUri = fileUris[0];

					// Read the content of the selected JSON file
					vscode.workspace.fs.readFile(fileUri).then(content => {
						const jsonContent = content.toString();

						reactPanel = ReactPanel.createOrShow(context.extensionPath);
						// Pass the file name and content to the webview
						reactPanel.sendMessage('VSCtest', { name: fileUri.fsPath, content: jsonContent });
					});
				}
			});
		} else {
			const fileUri = activeEditor.document.uri;
			vscode.workspace.fs.readFile(fileUri).then(content => {
				const jsonContent = content.toString();

				reactPanel = ReactPanel.createOrShow(context.extensionPath);
				// Pass the file name and content to the webview
				reactPanel.sendMessage('VSCtest', { name: fileUri.fsPath, content: jsonContent });
			});
		}
	});

	context.subscriptions.push(disposableVisLH);
	context.subscriptions.push(disposabelOpenJsonInVis);
	context.subscriptions.push(disposableVisWithJson);
	context.subscriptions.push(disposableVis);
}

// This method is called when your extension is deactivated
export function deactivate() { }

function getNonce() {
	let text = "";
	const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}