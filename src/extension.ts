// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import ReactPanel from './reactPanel';
import Prototype from './prototype';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('extension "aldesco-extension" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const configuration = vscode.workspace.getConfiguration('aldesco-extension');
	let reactPanel: ReactPanel | undefined;
	let basename: string;
	let fileContent: string;

	//Opens Visualizer without log File
	context.subscriptions.push(
		vscode.commands.registerCommand('aldesco-extension.visualizer', () => {
			reactPanel = ReactPanel.createOrShow(context.extensionPath);
			updateReactPanel(reactPanel);
		})
	);

	//opens Visualizer with log file (right click on json file)
	context.subscriptions.push(
		vscode.commands.registerCommand('aldesco-extension.rightClickLogFile', (fileUri: vscode.Uri, tree?: string) => {
			basename = path.posix.basename(fileUri.path);
			fileContent = fs.readFileSync(fileUri.fsPath, 'utf8').toString();

			reactPanel = ReactPanel.createOrShow(context.extensionPath, basename);

			if (reactPanel && basename && fileContent) {
				if (tree !== '/' && tree !== '/ASTView' && tree !== '/patternView') {
					tree = '/';
				}
				console.log(tree);
				reactPanel.sendMessage('VSC:OpenFile', { name: basename, content: fileContent, tree: tree });
			}
			updateReactPanel(reactPanel);
		})
	);

	//open Log file in Visualizer
	context.subscriptions.push(
		vscode.commands.registerCommand('aldesco-extension.openLogFileInVis', () => {
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
						readFileOpenVis(reactPanel, fileUri, context.extensionPath);
					}
				});
			} else {
				const fileUri = activeEditor.document.uri;
				readFileOpenVis(reactPanel, fileUri, context.extensionPath);
			}
			updateReactPanel(reactPanel);
		})
	);

	//for duplicating the last used webview
	context.subscriptions.push(
		vscode.commands.registerCommand('aldesco-extension.duplicateVis', () => {
			if (reactPanel) {
				reactPanel.duplicateActive(context.extensionPath);
				reactPanel.changeTitle(basename);
			} else {
				vscode.window.showInformationMessage('No Visualizer Active to Duplicate');
			}
		})
	);

	//for opening the most recently generated visualizer log file
	context.subscriptions.push(
		vscode.commands.registerCommand('aldesco-extension.openMostRecentLogFile', () => {
			const logFileDirPath = configuration.get('prototype.visualizerLogFileDirectoryLocation') as string;

			const directories = fs.readdirSync(logFileDirPath, { withFileTypes: true })
				.filter(dirent => dirent.isDirectory())
				.map(dirent => dirent.name);

			// Sort the directories based on their modification time (most recent first)
			directories.sort((dirA, dirB) => {
				const statsA = fs.statSync(path.join(logFileDirPath, dirA));
				const statsB = fs.statSync(path.join(logFileDirPath, dirB));
				return statsB.mtimeMs - statsA.mtimeMs;
			});

			if (directories.length > 0) {
				const latestDir = directories[0];
				const latestDirPath = path.join(logFileDirPath, latestDir);

				// Get the list of files in the most recent directory
				const files = fs.readdirSync(latestDirPath, { withFileTypes: true })
					.filter(dirent => dirent.isFile())
					.map(dirent => dirent.name);

				// Sort the files based on their modification time (most recent first)
				files.sort((fileA, fileB) => {
					const statsA = fs.statSync(path.join(latestDirPath, fileA));
					const statsB = fs.statSync(path.join(latestDirPath, fileB));
					return statsB.mtimeMs - statsA.mtimeMs;
				});

				if (files.length > 0) {
					const latestFile = files[0];
					const latestFilePath = path.join(latestDirPath, latestFile);

					readFileOpenVis(reactPanel, vscode.Uri.file(latestFilePath), context.extensionPath);
				}
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

	context.subscriptions.push(
		vscode.commands.registerCommand('aldesco-extension.startPrototype', () => {
			const prototype = new Prototype(context.extensionPath);
			prototype.execute();
		})
	);

}

function updateReactPanel(reactPanel: ReactPanel | undefined) {
	vscode.commands.executeCommand('setContext', 'reactPanel', reactPanel);
}

function readFileOpenVis(reactPanel: ReactPanel | undefined, fileUri: vscode.Uri, extensionPath: string) {
	vscode.workspace.fs.readFile(fileUri).then(content => {
		const jsonContent = content.toString();
		reactPanel = ReactPanel.createOrShow(extensionPath, fileUri.fsPath);
		// Pass the file name and content to the webview
		reactPanel.sendMessage('VSC:OpenFile', { name: fileUri.fsPath, content: jsonContent });
	});
}

// This method is called when your extension is deactivated
export function deactivate() { }

