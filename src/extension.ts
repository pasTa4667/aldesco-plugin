import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import Prototype from './prototype/ptCommands';
import {initiateTreeView} from './treeViewProvider';
import Visualizer from './visualizer';

// This method is called when your extension is activated
// Your extension is activated once vscode has finished starting up
export function activate(context: vscode.ExtensionContext) {

	// This line of code will only be executed once when your extension is activated
	console.log('extension "aldesco-extension" is now active!');

	const configuration = vscode.workspace.getConfiguration('aldesco-extension');
	
	//updating ref for commands to show/hide
	updateIsEditorJava(getActiveEditor());

	//adding output folder tree view to explorer
	initiateTreeView();
	
	let visualizer: Visualizer | undefined;
	let basename: string;
	let fileContent: string;
	
	//current chain for prototype matching
	let chain = configuration.get('prototype.chainLocation') as string;
	
	// The commandId parameter must match the command field in package.json
	// The commands have been defined in the package.json file
	
	//Opens Visualizer without log File
	context.subscriptions.push(
		vscode.commands.registerCommand('aldesco-extension.visualizer', async () => {
			visualizer = await Visualizer.createOrShow(context.extensionPath);
			updateVisualizerContext(visualizer);
		})
	);

	//opens Visualizer with log file (right click on json file)
	context.subscriptions.push(
		vscode.commands.registerCommand('aldesco-extension.rightClickLogFile', async (fileUri: vscode.Uri, tree?: string) => {
			basename = path.posix.basename(fileUri.path);
			fileContent = fs.readFileSync(fileUri.fsPath, 'utf8').toString();
			
			visualizer = await Visualizer.createOrShow(context.extensionPath, basename);

			if (visualizer && basename && fileContent) {
				if (tree !== '/' && tree !== '/ASTView' && tree !== '/patternView') {
					tree = '/';
				}
				await visualizer.sendMessageWithAck('VSC:OpenFile', { name: basename, content: fileContent, tree: tree });
			}
			updateVisualizerContext(visualizer);
		})
	);

	//open Log file in Visualizer
	context.subscriptions.push(
		vscode.commands.registerCommand('aldesco-extension.openLogFileInVis', () => {
			const activeEditor = getActiveEditor();
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
						readFileOpenVis(fileUri, context.extensionPath).then((vis) => {
							visualizer = vis;
							updateVisualizerContext(visualizer);
						});
					}
				});
			} else {
				const fileUri = activeEditor.document.uri;
				readFileOpenVis(fileUri, context.extensionPath).then((vis) => {
					visualizer = vis;
					updateVisualizerContext(visualizer);
				});
			}
		})
	);

	//for duplicating the last used webview
	context.subscriptions.push(
		vscode.commands.registerCommand('aldesco-extension.duplicateVis', async () => {
			if (visualizer) {
				visualizer.duplicateActive(context.extensionPath, basename);
			} else {
				vscode.window.showInformationMessage('No Visualizer Active to Duplicate');
			}
		})
	);

	//for opening the most recently generated visualizer log file
	context.subscriptions.push(
		vscode.commands.registerCommand('aldesco-extension.openMostRecentLogFile', (tree?: string) => {
			const wsFolder = vscode.workspace.workspaceFolders?.[0];
			
			if(!wsFolder){
				vscode.window.showWarningMessage('There is no accessible .visualizer-logs folder within your current Project!');
				return;
			}

			const visLogsFolder = path.join(wsFolder.uri.fsPath, 'aldesco-output', '.visualizer-logs');

			if(!fs.existsSync(visLogsFolder)){
				vscode.window.showWarningMessage('There is no accessible .visualizer-logs folder within your current Project!');
				return;
			}

			const directories = fs.readdirSync(visLogsFolder, { withFileTypes: true })
				.filter(dirent => dirent.isDirectory())
				.map(dirent => dirent.name);

			// Sort the directories based on their modification time (most recent first)
			directories.sort((dirA, dirB) => {
				const statsA = fs.statSync(path.join(visLogsFolder, dirA));
				const statsB = fs.statSync(path.join(visLogsFolder, dirB));
				return statsB.mtimeMs - statsA.mtimeMs;
			});

			if (directories.length > 0) {
				const latestDir = directories[0];
				const latestDirPath = path.join(visLogsFolder, latestDir);

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
					readFileOpenVis(vscode.Uri.file(latestFilePath), context.extensionPath, tree).then((vis) => {
						visualizer = vis;
						updateVisualizerContext(visualizer);
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
			//either open file explorer
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
						await configuration.update('prototype.chainLocation', chain, false);
						vscode.window.showInformationMessage('Current chain updated to:', path.basename(file.fsPath));

					}
				});
			//or get the right clicked file
			} else if(fileUri.fsPath.includes('.java')){
				const content = fs.readFileSync(fileUri.fsPath, 'utf-8');

				if (!content.includes('PatternMatchingDescriptionChain')){
					vscode.window.showErrorMessage('File is not a valid chain', path.basename(fileUri.path));
					return;
				}

				const compiledPath = await Prototype.getCompiledFromJava(fileUri.fsPath);
				if (compiledPath){
					chain = compiledPath;	
					await configuration.update('prototype.chainLocation', chain, false);
					vscode.window.showInformationMessage('Current chain updated to:', path.basename(fileUri.fsPath));
				}
			
			} else if (fileUri.fsPath.includes('.class')){
				chain = fileUri.fsPath;
				await configuration.update('prototype.chainLocation', chain, false);
				vscode.window.showInformationMessage('Current chain updated to:', path.basename(fileUri.fsPath));
			
			}
		})
	);

	//compiles all project files and sets the selected as Chain
	context.subscriptions.push(
		vscode.commands.registerCommand('aldesco-extension.compileAllAndSetChain', async (fileUri: vscode.Uri) => {
			if(fileUri){
				const compiled = await Prototype.compileAllFiles(fileUri.fsPath);
				if (compiled) {
					chain = compiled;
					await configuration.update('prototype.chainLocation', chain, false);
					vscode.window.showInformationMessage('File compiled and current chain updated to:', path.basename(fileUri.fsPath));
				}
			}
		})
	);

	//compiles one java file and sets it as Chain
	context.subscriptions.push(
		vscode.commands.registerCommand('aldesco-extension.compileSingleAndSetChain', async (fileUri: vscode.Uri) => {
			if (fileUri) {
				const compiled = await Prototype.compileSingleFile(context.extensionPath, fileUri.fsPath);
				if (compiled) {
					chain = compiled;
					await configuration.update('prototype.chainLocation', chain, false);
					vscode.window.showInformationMessage('File compiled and current chain updated to:', path.basename(fileUri.fsPath));
				}
			}
		})
	);
	
	//start prototype spoon ast visualizer with selected content
	context.subscriptions.push(
		vscode.commands.registerCommand('aldesco-extension.visualizeSpoonAST', async () => {
			const activeEditor = getActiveEditor();
			if(activeEditor){
				const fileUri = activeEditor.document.uri;
				const selection = activeEditor.document.getText(activeEditor.selection);
				
				if(!selection){
					vscode.window.showInformationMessage('Nothing selected.');
					return;
				}
				
				const endLine = activeEditor.selection.end.line;
				const fileContent = activeEditor.document.getText();
				const textBeforeSelection = fileContent.split('\n').slice(0, endLine + 1).join('\n');
				const sourceStart = textBeforeSelection.lastIndexOf(selection);
				const sourceEnd = sourceStart + selection.length - 1;

				await Prototype.visualizeSpoonAST(context.extensionPath, fileUri.fsPath, sourceStart, sourceEnd)
					.then(() => {
						vscode.commands.executeCommand('aldesco-extension.openMostRecentLogFile', '/ASTView');
					})
					.catch(() => {
						vscode.window.showErrorMessage('Visualizer File could not be generated.');
					});
			}
		})
	);

	//starts prototype folder matching with current chain
	context.subscriptions.push(
		vscode.commands.registerCommand('aldesco-extension.folderMatching', async (folder: vscode.Uri) => {
			//if chain was not set, get it from settings
			if(!chain){
				chain = configuration.get('prototype.chainLocation', '');
			}
			let folderPath = folder.fsPath;

			if(!folder){
				vscode.window.showOpenDialog({
					canSelectFiles: false,
					canSelectFolders: true,
					canSelectMany: false,
				}).then(folderUris => {
					if (folderUris && folderUris[0]) {
						folderPath = folderUris[0].fsPath;	
					}
				});
			}
			
			await Prototype.matchFolderWithChain(context.extensionPath, chain, folder.fsPath)
				.catch((error) => {
					vscode.window.showErrorMessage(error);
				});	

		})
	);

	//outputs the current chain
	context.subscriptions.push(
		vscode.commands.registerCommand('aldesco-extension.currentChain', () => {
		if(chain){
				vscode.window.showInformationMessage('Current Chain is:', path.basename(chain));
			}else{
				vscode.window.showInformationMessage('Chain is not set!');
			}
		})
	);

	//command for testing
	context.subscriptions.push(
		vscode.commands.registerCommand('aldesco-extension.testing', async () => {
			const terminal = vscode.window.createTerminal('Testing');
			terminal.sendText(`This is \n a test`, false);
		terminal.show();
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

async function readFileOpenVis(fileUri: vscode.Uri, extensionPath: string, tree?: string): Promise<Visualizer | undefined> {
	const content = await vscode.workspace.fs.readFile(fileUri);
	const jsonContent = content.toString();
	const basename = path.basename(fileUri.fsPath);
	const visualizer = await Visualizer.createOrShow(extensionPath, basename);
	
	if(visualizer){
		await visualizer.sendMessageWithAck('VSC:OpenFile', { name: basename, content: jsonContent, tree: tree ? tree : '/' });
	}
	return visualizer;
}

function updateVisualizerContext(vis: Visualizer | undefined) {
	vscode.commands.executeCommand('setContext', 'visualizer', vis);
}

function getActiveEditor(): vscode.TextEditor | undefined {
	return vscode.window.activeTextEditor;
}

// This method is called when your extension is deactivated
export function deactivate() { }

