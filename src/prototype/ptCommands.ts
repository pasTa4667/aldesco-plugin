
import { format } from "date-fns";
import * as spawner from "./spawner";
import * as fileUtils from "./fileUtils";
import { join, basename } from 'path';
import * as vscode from 'vscode';

export default class Prototype {

    private static readonly _prototypePath = 'prototype/ast-prototype-1.0.0.jar';
    private static readonly _outputFormat = 'd-MMM-yyyy-HH-mm-ss';
    
    public static visualizeSpoonAST(extensionPath: string, file: string, startLine?: number, endLine?: number): Promise<void>{
        return new Promise(async (resolve, reject) => {
            const args = ['--file', file];
            
            if(startLine && endLine){
                args.push('--position');
                args.push(`${startLine.toString()}-${endLine.toString()}`);
            }
            
            //from where the command is run
            const outputFolder = await fileUtils.createOrGetOutputFolder(extensionPath);
            //the local prototype path in the extension
            const absPrototypePath = join(extensionPath, this._prototypePath);

            try{
                await spawner.run('java', ['-jar', absPrototypePath, ...args], { cwd: outputFolder});  
            }catch(err){
                reject();
            }
            resolve();
        });
    }

    public static compileAllFiles(filePath: string): Promise<string>{
        return new Promise<string>(async (resolve) => {
            const wsFolder = vscode.workspace.workspaceFolders?.[0]; // Get the top level workspace folder

            if(!wsFolder){
                vscode.window.showInformationMessage('No Project found to compile file in!');
                return;
            }

            const pre = fileUtils.getPrefix();
            const command = fileUtils.getCompileCommand(wsFolder);

            if(!command){
                vscode.window.showErrorMessage('Build tool not supported! Only gradle or maven projects can be build.');
                return;
            }

            try {
                await spawner.run(`${pre}${command[0]}`, [command[1]], { cwd: wsFolder.uri.fsPath, shell: true });
            } catch (err) {
                console.log(err);
                vscode.window.showErrorMessage(`Files couldn't be compiled!`);
                resolve('');
            }
            resolve(fileUtils.getCompiledFromJava(filePath));
        });
    }

    public static compileSingleFile(extensionPath: string, filePath: string): Promise<string>{
        return new Promise<string>(async (resolve) => {

            const wsFolder = vscode.workspace.workspaceFolders?.[0]; // Get the top level workspace folder
            const projectDirPath = wsFolder!.uri.fsPath;

            if(!projectDirPath){
                vscode.window.showWarningMessage('No Project found to compile file in!');
                return;
            }

            const buildPath = fileUtils.getBuildPath(projectDirPath);

            if(!buildPath){
                vscode.window.showInformationMessage('No Build Folder found. Compiling all files ...');
                return this.compileAllFiles(filePath);
            }

            const prototypeJarPath = join(extensionPath, 'prototype', 'ast-prototype-1.0.0.jar'); 

            //javac adds packages to the target directory for use
            const args = ['-cp', `${buildPath};${prototypeJarPath}`, '-d', buildPath, filePath];

            try {
                await spawner.run('javac', args, { cwd: projectDirPath });
            } catch (err) {
                console.log(err);
                vscode.window.showErrorMessage(`File couldn't be compiled!`);
                resolve('');
            }
            resolve(fileUtils.getCompiledFromJava(filePath));

        });
    }

    public static matchFolderWithChain(extensionPath: string, chainPath: string, folderPath: string): Promise<void> {     
        return new Promise<void>(async (resolve, reject) => {
            if(!chainPath){
                reject(new Error(`Chain is not set!`));
            }
            const absPrototypePath = join(extensionPath, this._prototypePath);

            const folderName = basename(folderPath);
            const formattedDate = format(new Date(), this._outputFormat);
            const outputName = `${folderName}-${formattedDate}.json`;

            //dir from where the command is run and the output is being placed
            const outputFolder = await fileUtils.createOrGetOutputFolder(extensionPath);
            
            const args = ['--chain', chainPath, '--input', folderPath, '--output', join(outputFolder, outputName)]; 

            try {
                this.executeInTerminal('java', '-jar', absPrototypePath, ...args);
            } catch (err) {
                reject(new Error(`Error during matching process`));
            }
            resolve();
        });
    }
    
    private static executeInTerminal(...args: string[]){
        const terminal = vscode.window.activeTerminal ? vscode.window.activeTerminal : vscode.window.createTerminal();
        terminal.show();
        terminal.sendText(args.join(' '));
    }

    //searches for a .class file in the build folder from a .java file name in the src folder
    public static getCompiledFromJava(notCompiledPath: string): Promise<string> {
        return new Promise<string>(async (res) => {
            const compiled = fileUtils.getCompiledFromJava(notCompiledPath);
    
            if(compiled.length === 0){
                const compiledPath = await this.compileAllFiles(notCompiledPath);
                res(compiledPath);
            }
    
            if(!compiled){
                res('');
            }else{
                res(compiled);
            }
    
        });
    }

}
