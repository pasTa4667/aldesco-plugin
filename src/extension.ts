// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import ReactPanel from './reactPanel';
import Prototype from './prototype';

// This method is called when your extension is activated
// Your extension is activated once vscode has finished starting up
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('extension "aldesco-extension" is now active!');

	// The commands have been defined in the package.json file
	// The commandId parameter must match the command field in package.json
	const configuration = vscode.workspace.getConfiguration('aldesco-extension');
	
	//get active editor and enable/disable visualizeSpoonAST command
	const activeEditor = vscode.window.activeTextEditor;
	updateIsEditorJava(activeEditor);

	let reactPanel: ReactPanel | undefined;
	let basename: string;
	let fileContent: string;

	//current chain for prototype matching
	let chain = configuration.get('prototype.chainLocation', '');

	//Opens Visualizer without log File
	context.subscriptions.push(
		vscode.commands.registerCommand('aldesco-extension.visualizer', async () => {
			reactPanel = await ReactPanel.createOrShow(context.extensionPath);
			updateReactPanel(reactPanel);
		})
	);

	//opens Visualizer with log file (right click on json file)
	context.subscriptions.push(
		vscode.commands.registerCommand('aldesco-extension.rightClickLogFile', async (fileUri: vscode.Uri, tree?: string) => {
			basename = path.posix.basename(fileUri.path);
			fileContent = fs.readFileSync(fileUri.fsPath, 'utf8').toString();

			reactPanel = await ReactPanel.createOrShow(context.extensionPath, basename);

			if (reactPanel && basename && fileContent) {
				if (tree !== '/' && tree !== '/ASTView' && tree !== '/patternView') {
					tree = '/';
				}
				console.log(basename);
				//really make sure the message is only send when the reactPanel is ready
				setTimeout(() => {
					reactPanel?.sendMessage('VSC:OpenFile', { name: basename, content: fileContent, tree: tree });
				}, 700);
			}
			updateReactPanel(reactPanel);
		})
	);

	//open Log file in Visualizer
	context.subscriptions.push(
		vscode.commands.registerCommand('aldesco-extension.openLogFileInVis', () => {
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
						readFileOpenVis(fileUri, context.extensionPath).then((rp) => {
							reactPanel = rp;
							updateReactPanel(reactPanel);
						});
					}
				});
			} else {
				const fileUri = activeEditor.document.uri;
				readFileOpenVis(fileUri, context.extensionPath).then((rp) => {
					reactPanel = rp;
					updateReactPanel(reactPanel);
				});
			}
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
		vscode.commands.registerCommand('aldesco-extension.openMostRecentLogFile', (tree?: string) => {
			const aldescoProjectDir = configuration.get('prototype.aldescoProjectDirectory') as string;
			const logFileDirPath = path.join(aldescoProjectDir, '.visualizer-logs');
			console.log(logFileDirPath);

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

					if(!latestFilePath.includes('vis')){
						vscode.window.showInformationMessage('No Vis File found to display');
						return;
					}
					if (tree !== '/' && tree !== '/ASTView' && tree !== '/patternView') {
						tree = '/';
					}
					readFileOpenVis(vscode.Uri.file(latestFilePath), context.extensionPath, tree).then((rp) => {
						reactPanel = rp;
						updateReactPanel(reactPanel);
					});
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

	//set a .java or .class file as chain
	context.subscriptions.push(
		vscode.commands.registerCommand('aldesco-extension.setChain', async (fileUri: vscode.Uri) => {
			const chainDir = path.join(context.extensionPath, 'prototype', 'chain');
			console.log(fileUri);
			if (!fileUri) {
				vscode.window.showOpenDialog({
					canSelectFiles: true,
					canSelectFolders: false,
					canSelectMany: false,
					filters: {
						'ClassFiles': ['class']
					}
				}).then(async fileUris => {
					if (fileUris && fileUris[0]) {
						const file = fileUris[0];
						chain = file.fsPath;
						await configuration.update('prototype.chainLocation', chain);
						vscode.window.showInformationMessage('Current chain updated to:', path.posix.basename(file.fsPath));

					}
				});
			} else if(fileUri.fsPath.includes('.java')){
				const content = fs.readFileSync(fileUri.fsPath, 'utf-8');

				if (!content.includes('PatternMatchingDescriptionChain')){
					vscode.window.showErrorMessage('File is not a valid chain', path.posix.basename(fileUri.path));
					return;
				}

				if(await Prototype.compileJavaFile(context.extensionPath, fileUri.fsPath)){
					chain = path.join(chainDir, path.basename(fileUri.fsPath));
					await configuration.update('prototype.chainLocation', chain);
					vscode.window.showInformationMessage('File compiled and current chain updated to:', path.posix.basename(fileUri.fsPath));
				}
			
			} else if (fileUri.fsPath.includes('.class')){
				chain = fileUri.fsPath;
				await configuration.update('prototype.chainLocation', chain);
				vscode.window.showInformationMessage('Current chain updated to:', path.posix.basename(fileUri.fsPath));
			
			}
		})
	);
	
	//start prototype spoon ast visualizer with method or file
	context.subscriptions.push(
		vscode.commands.registerCommand('aldesco-extension.visualizeSpoonAST', async (...args) => {

			if(activeEditor){
				const fileUri = activeEditor.document.uri;
				const startLine = activeEditor.selection.start;

				//startLine + 1 since vscode gives us the line before the selected line 
				if (await Prototype.visualizeSpoonAST(context.extensionPath, fileUri.fsPath, startLine && args.length > 0 ? startLine.line + 1: undefined)){
					vscode.commands.executeCommand('aldesco-extension.openMostRecentLogFile', '/ASTView');
				}				
			}
		})
	);

	//starts prototype folder matching with current chain
	context.subscriptions.push(
		vscode.commands.registerCommand('aldesco-extension.folderMatching', async (folder: vscode.Uri) => {
			chain = configuration.get('prototype.chainLocation', '');
			console.log('is', chain);
			if(!chain)
				vscode.window.showErrorMessage('Chain is not set!');

			if(!folder){
				vscode.window.showOpenDialog({
					canSelectFiles: false,
					canSelectFolders: true,
					canSelectMany: false,
				}).then(folderUris => {
					if (folderUris && folderUris[0]) {
						folder = folderUris[0];	
						Prototype.matchFolderWithChain(context.extensionPath, chain, folder.fsPath);	
					}
				});
			}else{
				Prototype.matchFolderWithChain(context.extensionPath, chain, folder.fsPath);	
			}
		})
	);

	//outputs the current chain
	context.subscriptions.push(
		vscode.commands.registerCommand('aldesco-extension.currentChain', () => {
			if(chain){
				vscode.window.showInformationMessage('Current Chain is:', chain);
			}else{
				vscode.window.showInformationMessage('Chain is not set!');
			}
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
			let activeTerminal = vscode.window.activeTerminal;
			if (!activeTerminal) {
				activeTerminal = vscode.window.createTerminal();
			}
			activeTerminal.show();
			activeTerminal.sendText('hello');
			//reactPanel?.sendMessage("test", "heeeeelllo");
		})
	);

	//checking whether active editor is java file, if so enable command
	vscode.window.onDidChangeActiveTextEditor((editor) => {
		updateIsEditorJava(editor);
	});
}

function updateIsEditorJava(editor: vscode.TextEditor | undefined){
	if (editor && editor.document.uri.fsPath.includes('.java')) {
		vscode.commands.executeCommand('setContext', 'isEditorJava', true);
	}else{
		vscode.commands.executeCommand('setContext', 'isEditorJava', false);
	}
}

function updateReactPanel(reactPanel: ReactPanel | undefined) {
	vscode.commands.executeCommand('setContext', 'reactPanel', reactPanel);
}

async function readFileOpenVis(fileUri: vscode.Uri, extensionPath: string, tree?: string): Promise<ReactPanel | undefined> {
	const content = await vscode.workspace.fs.readFile(fileUri);
	const jsonContent = content.toString();
	const reactPanel = await ReactPanel.createOrShow(extensionPath, fileUri.fsPath);
	setTimeout(() => {
		reactPanel?.sendMessage('VSC:OpenFile', { name: fileUri.fsPath, content: jsonContent, tree: tree? tree : '/' });
	}, 700);
	return reactPanel;
}

// This method is called when your extension is deactivated
export function deactivate() { }

