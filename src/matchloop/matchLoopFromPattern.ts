import * as vscode from 'vscode';
import * as statusBarItem from './statusBarItem';
import * as fileUtils from "../prototype/fileUtils";
import { join, basename } from 'path';
import { copyFile } from 'fs';
import Prototype from '../prototype/ptCommands'; 
import { ResultContainer, analyzeMatchResults } from "../treeView/treeViewProvider";


let matchLoopDisposable: vscode.Disposable | null;
let toMatchFolderPath: string;

const matchLoopResultFileName = 'match-loop-results.json';
const columnSeparator = ' \u2502 ';

export async function startMatchLoopFromPattern(patternFilePath: string, extensionPath: string) {
    const wsFolders = vscode.workspace.workspaceFolders;

    if (!wsFolders) {
        vscode.window.showErrorMessage('Workspace does not exist');
        return;
    }

    //create a folder with input files in it 
    if(!toMatchFolderPath){
        await createOrGetInputMatchFolder(extensionPath);
    }
    
    //start matching with compiled pattern and folder
    //analyze the output
    //show analyzed output
    statusBarItem.initialize();
    let isProcessing = false;
    let hasCompiled = true;
    let compiledPatternPath: string;

    //path to the match-loop-result.json which will be generated
    const matchResultFilePath = vscode.Uri.file(await getPathToMatchResultFile(extensionPath));

    vscode.window.showInformationMessage('Match Loop Started with ' + basename(patternFilePath));

    matchLoopDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.uri.fsPath === patternFilePath && !isProcessing) {
            isProcessing = true;
            hasCompiled = true;

            setTimeout(async () => {

                //second timeout so we dont execute it muliple times
                setTimeout(() => {
                    isProcessing = false;
                }, 2000);
                
                //need to safe document or else it wont compile correct file
                await event.document.save();

                //compile pattern file and get path
                await Prototype.compileSingleFile(extensionPath, patternFilePath).then((compiledPath) => {
                    compiledPatternPath = compiledPath;
                }).catch((error) => {
                    hasCompiled = false;
                });

                //starting the matching process if the file compiles
                if(hasCompiled){
                    statusBarItem.setLoadingState();
                    //match folder with the open pattern
                    await Prototype.matchFolderWithChainML(extensionPath, compiledPatternPath, toMatchFolderPath)
                        .then(async (v) => {
                            console.log("match success");
                            //generate the match tree view, to analyze results
                            const root = await vscode.commands.executeCommand('aldesco-extension.openMatchesAsTree', matchResultFilePath);
                            //add analyzed results to status bar
                            addResultsToStatusBarItem(analyzeMatchResults(root as ResultContainer));
                        })
                        .catch((error) => {
                            console.log("match error: ", error);
                            statusBarItem.setFailedState();
                        });
                }

            }, 1500);
        }
    });
}

export async function addMatchInputFile(inputFilePath: string, extensionPath: string){
    //creating the folder holding the files to be matched
    if(!toMatchFolderPath){
        await createOrGetInputMatchFolder(extensionPath);
    }

    const fileName = basename(inputFilePath);
    const destinationPath = join(toMatchFolderPath, fileName);

    //copy the file
    copyFile(inputFilePath, destinationPath, (err) => {
        if (err) {
            vscode.window.showWarningMessage('Adding input file failed: ' + err);
        } else {
            vscode.window.showInformationMessage('Added input file.');
        }
    });
}

function addResultsToStatusBarItem(results?: Map<string, number>){
    if(!results || results.size === 0){
        statusBarItem.setFailedState('No Match');
        return;
    }

    statusBarItem.setMatchedState(`${results.size} Files Matched`);

    let toolTipText: string[] = [];
    
    results.forEach((matches, fileName) => {
        toolTipText.push(`<tr><td>${fileName}&emsp;</td><td>${matches} Match(es)</td></tr>`);
    });
    //importend: no tabs or linebreaks in the html, or it wont work
    const html = `<table>${toolTipText.join('')}</table>`;
    const md = new vscode.MarkdownString(html);
    md.isTrusted = true;
    md.supportHtml = true;
    statusBarItem.setToolTip(md);
}

async function getPathToMatchResultFile(extensionPath: string){
    const resultPath  = await fileUtils.createOrGetOutputFolder(extensionPath);

    return join(resultPath, matchLoopResultFileName);
}

async function createOrGetInputMatchFolder(extensionPath: string) {
    const outputPath = await fileUtils.createOrGetOutputFolder(extensionPath);

    await fileUtils.createOrGetFolder(outputPath, 'MatchInputs')
        .then((path) => {
            toMatchFolderPath = path;
        }).catch((err) => {
            vscode.window.showWarningMessage('Match Input Folder couldnt be generated: ', err);
            return;
        });
}



