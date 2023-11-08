import { existsSync, readFileSync, readdirSync } from 'fs';
import { basename, extname, join } from 'path';
import * as vscode from 'vscode';
import { run } from '../prototype-commands/spawner';
import { openFile } from '../prototype-commands/fileUtils';
import * as statusBarItem from './statusBarItem';


let matchLoopDisposable: vscode.Disposable | null;

export async function startMatchLoopFromTest(testFilePath: string) {
    const wsFolders = vscode.workspace.workspaceFolders;

    if(!wsFolders){
        vscode.window.showErrorMessage('Workspace does not exist');
        return;
    }

    //execute test
    const commandArgs = getExecTestCommnad(testFilePath, wsFolders[0]);
    const command = commandArgs.shift();

    if(!command){
        console.log("no command");
        return;
    }
    
    let patternFilePath: string;

    //we know activeEditor and text is not undefined since this command 
    //can only be executed when an editor exists
    const activeEditorText = vscode.window.activeTextEditor!.document.getText();
    await extractChainPath(activeEditorText, wsFolders[0])
            .then((path) => {
                openFile(path);
                patternFilePath = path;
            }).catch((error) => {
                vscode.window.showErrorMessage(error);
                return;
            });

    await extractResourcePath(activeEditorText, wsFolders[0])
            .then((path) => {
                openFile(path, vscode.ViewColumn.Two);
            }).catch((error) => {
                vscode.window.showInformationMessage(error);
            });
    
    statusBarItem.initialize();
    let isProcessing = false;

    //do this when in pattern file
    matchLoopDisposable = vscode.workspace.onDidChangeTextDocument(async (event) => {
        if (event.document.uri.fsPath === patternFilePath && !isProcessing) {
            isProcessing = true;
            
            // Set a new timeout to wait for inactivity
            setTimeout(async () => {
                statusBarItem.setLoadingState();
                await event.document.save();

                //if(!await hasDiagnosticsError(event.document.uri)){

                    await run(command, commandArgs, { cwd: wsFolders[0].uri.fsPath, shell: true }).then(() => {
                        //positive match
                        statusBarItem.setMatchedState();
                        console.log("test successful");
                    }).catch(() => {
                        //negative match
                        statusBarItem.setFailedState();
                        console.log("test failed");
                    });
    
                    setTimeout(() => {
                        isProcessing = false;
                    }, 2000);
                //}

            }, 1500);
        } 
    });
}

function hasDiagnosticsError(uri: vscode.Uri): Promise<boolean>{
    return new Promise<boolean>((resolve)=>{
        const diagnostics = vscode.languages.getDiagnostics(uri);
        const hasError = diagnostics.some((diagnostic) => diagnostic.severity === vscode.DiagnosticSeverity.Error);
        resolve(hasError);
    });
}

export function disposeMatchLoopFromTest() {
    if (matchLoopDisposable) {
        statusBarItem.dispose();
        matchLoopDisposable.dispose();
    }
}

async function extractResourcePath(activeEditorText: string, wsFolder: vscode.WorkspaceFolder) {
    return new Promise<string>((resolve, reject) => {
        const pattern = /launcher\.addInputResource\("(.+?)"\);/;
        const match = activeEditorText.match(pattern);

        if (match && match[1]) {
            if(existsSync(match[1])){
                resolve(match[1]);
            }else{
                resolve(join(wsFolder.uri.fsPath, match[1]));
            }
        }
        reject('No Resource Path found'); // If no match is found
    });
}

async function extractChainPath(activeEditorText: string, wsFolder: vscode.WorkspaceFolder) {
    return new Promise<string>((resolve, reject) => {
        const pattern = /([A-Za-z_$][A-Za-z0-9_$]*\.CHAIN)/;
        const match = activeEditorText.match(pattern);

        if (match && match.length === 2) {
            const className = match[1].split('\.')[0];

            if (!wsFolder) {
                reject('No workspace Folder found!');
            }

            // Define the path to the 'src' folder
            const srcFolderPath = join(wsFolder.uri.fsPath, 'src');

            // Use the 'vscode.workspace.findFiles' function to search for the file within the 'src' folder
            const filePattern = new vscode.RelativePattern(srcFolderPath, `**/${className}.java`);
            vscode.workspace.findFiles(filePattern).then((matchingFiles) => {
                if (matchingFiles.length === 0) {
                    reject('No File found with that name!');
                } else {
                    // Resolve with the file path
                    resolve(matchingFiles[0].fsPath);
                }
            });
        } else if(match && match.length > 2){ //open file dialog if multiple .CHAIN exists
            vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    'JavaFiles': ['java']
                }
            }).then(async fileUris => {
                if (fileUris && fileUris[0]) {
                    resolve(fileUris[0].fsPath);
                }
            });
        } else {
            reject('No Chain found in the Test! (Variable has to be named CHAIN)');
        }
    });
}

function constructPackagePath(testFilePath: string){
    const javaFileContents = readFileSync(testFilePath, 'utf8');

    // Determine the Java file name without the extension
    const javaFileName = basename(testFilePath, extname(testFilePath));

    // Extract the package declaration from the Java file
    const packageDeclaration = javaFileContents.match(/package\s+([\w.]+)\s*;/);

    if (!packageDeclaration) {
        return javaFileName;
    }

    // Construct the package path
    return `${packageDeclaration[1]}.${javaFileName}`;
}

function getExecTestCommnad(filePath: string, wsFolder: vscode.WorkspaceFolder): string[] {
    if(!wsFolder){
        return [];
    }

    const folder = readdirSync(wsFolder.uri.fsPath);
    const command: string[] = [];

    if (folder.includes('build.gradle')) {
        command[0] = `gradle${folder.includes('gradlew') ? 'w' : ''}`;
        command[1] = 'test';
        command[2] = '--tests';
        command[3] = constructPackagePath(filePath);
        return command;
    }

    if (folder.includes('pom.xml')) {
        command[0] = 'mvn';
        command[1] = 'test';
        command[2] = `-Dtest=${constructPackagePath(filePath)}`;
        return command;
    }
    return [];
}

