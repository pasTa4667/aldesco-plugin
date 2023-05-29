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
	context.subscriptions.push(
		vscode.commands.registerCommand('aldesco-extension.visualizer', () => {
			reactPanel = ReactPanel.createOrShow(context.extensionPath);
			updateReactPanel(reactPanel);
		})
	);

	//opens Visualizer with json (right click on json file)
	context.subscriptions.push(
		vscode.commands.registerCommand('aldesco-extension.rightClickLogFile', (fileUri: vscode.Uri, tree?: string) => {
			basename = path.posix.basename(fileUri.path);
			fileContent = fs.readFileSync(fileUri.fsPath, 'utf8').toString();

			reactPanel = ReactPanel.createOrShow(context.extensionPath);

			if (reactPanel && basename && fileContent) {
				reactPanel.sendMessage('VSC:OpenFile', { name: basename, content: fileContent, tree: tree ? tree : '/' });
			}
			updateReactPanel(reactPanel);
		})
	);

	//open json file in Visualizer
	context.subscriptions.push(
		vscode.commands.registerCommand('aldesco-extension.openJsonInVis', () => {
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
							reactPanel.sendMessage('VSC:OpenFile', { name: fileUri.fsPath, content: jsonContent });
						});
					}
				});
			} else {
				const fileUri = activeEditor.document.uri;
				vscode.workspace.fs.readFile(fileUri).then(content => {
					const jsonContent = content.toString();

					reactPanel = ReactPanel.createOrShow(context.extensionPath);
					// Pass the file name and content to the webview
					reactPanel.sendMessage('VSC:OpenFile', { name: fileUri.fsPath, content: jsonContent });
				});
			}
			updateReactPanel(reactPanel);
		})
	);

	//for duplicating the last used webview
	context.subscriptions.push(
		vscode.commands.registerCommand('aldesco-extension.duplicateVis', () => {
			if (reactPanel) {
				reactPanel.duplicateActive(context.extensionPath);
			} else {
				vscode.window.showInformationMessage('No Visualizer Active to Duplicate');
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('aldesco-extension.openPattern', (fileUri: vscode.Uri) => {
			vscode.commands.executeCommand('aldesco-extension.rightClickLogFile', fileUri, '/patternView');
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('aldesco-extension.openAST', (fileUri: vscode.Uri) => {
			vscode.commands.executeCommand('aldesco-extension.rightClickLogFile', fileUri, '/ASTView');
		})
	);


	//connect to visualizer via url (locally start visualizer first) (mainly for easier debugging)
	context.subscriptions.push(
		vscode.commands.registerCommand('aldesco-extension.connectToVisLH', () => {
			reactPanel = ReactPanel.createOrShowLH(context.extensionPath);
			updateReactPanel(reactPanel);
		})
	);

	//testing
	context.subscriptions.push(
		vscode.commands.registerCommand('aldesco-extension.sendMessage', () => {
			reactPanel?.sendMessage("test", "heeeeelllo");
		})
	);

}
function updateReactPanel(reactPanel: ReactPanel | undefined) {
	vscode.commands.executeCommand('setContext', 'reactPanel', reactPanel);
}

// This method is called when your extension is deactivated
export function deactivate() { }

