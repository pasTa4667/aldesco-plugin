import { spawn } from "child_process";
import { format } from "date-fns";
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export default class Prototype {

    private static readonly _prototypePath = 'prototype/ast-prototype-1.0.0.jar';
    private static readonly _configuration = vscode.workspace.getConfiguration('aldesco-extension');
    private static _outputChannel: vscode.OutputChannel;

    private static readonly _outputFormat = 'd-MMM-yyyy-HH-mm-ss';

    public static visualizeSpoonAST(extensionPath: string, file: string, startLine?: number): Promise<boolean>{
        return new Promise(async (resolve) => {
            const args = ['--file', file];
            
            if(startLine){
                args.push('--line');
                args.push(startLine.toString());
            }
            
            //from where the command is run
            const outputFolder = await this.createOrGetOutputFolder(extensionPath);
            const absPrototypePath = path.join(extensionPath, this._prototypePath);

            const childProcess = spawn('java', ['-jar', absPrototypePath, ...args], { cwd: outputFolder});

            // Handle events and output from the child process
            childProcess.stdout.on('data', (data) => {
               vscode.window.showInformationMessage(`Vsualizer: ${data}`);
            });
    
            childProcess.stderr.on('data', (data) => {
                vscode.window.showErrorMessage(`Visualizer file could not be generated:\n ${data}`);
                resolve(false);
            });
    
            childProcess.on('close', (code) => {
                code === 0 ? resolve(true) : resolve(false);
                console.log(`child process exited with code ${code}`);
            });
        });
    }

    public static compileJavaFile(extensionPath: string, file: string): Promise<boolean>{
        return new Promise<boolean>((resolve) => {
            const wsFolder = vscode.workspace.workspaceFolders?.[0]; // Get the top level workspace folder

            if(!wsFolder){
                vscode.window.showInformationMessage('No Project found to compile file!');
                return;
            }
            console.log('compiling in', wsFolder.uri.fsPath);
            
            const childProcess = spawn('gradlew', ['compileJava'], {cwd: wsFolder.uri.fsPath});

            // Handle events and output from the child process
            childProcess.stdout.on('data', (data) => {
                vscode.window.showInformationMessage(`Compiled successfully: ${data}`);
            });

            childProcess.stderr.on('data', (data) => {
                vscode.window.showErrorMessage(`File couldn't be compiled:\n ${data}`);
                resolve(false);
            });

            childProcess.on('close', (code) => {
                code === 0 ? resolve(true) : resolve(false);
                console.log(`child process exited with code ${code}`);
            });
        });
    }

    public static matchFolderWithChain(extensionPath: string, chainPath: string, folderPath: string): Promise<boolean> {     
        return new Promise<boolean>(async (resolve) => {
            if(!chainPath){
                vscode.window.showInformationMessage('Chain is not set!');
                resolve(false);
            }
            const absPrototypePath = path.join(extensionPath, this._prototypePath);

            const folderName = path.basename(folderPath);
            const formattedDate = format(new Date(), this._outputFormat);
            const outputName = `${folderName}-${formattedDate}.json`;

            //from where the command is run and the output is being placed
            const outputFolder = await this.createOrGetOutputFolder(extensionPath);
            console.log(outputFolder);

            const args = []; 
            args.push('--chain');
            args.push(chainPath);
            args.push('--input');
            args.push(folderPath);
            args.push('--output');
            args.push(outputName);

            const childProcess = spawn('java', ['-jar', absPrototypePath, ...args], { cwd: outputFolder });

            const output = this.createOrShowOutputChannel();
  
            // Handle events and output from the child process
            childProcess.stdout.on('data', (data) => {
                const parsed = (data.toString() as string).replace('', '->');
                output.append(parsed);
            });
    
            childProcess.stderr.on('data', (data) => {
                console.error(`stderr: ${data}`);
                resolve(false);
            });
    
            childProcess.on('close', (code) => {
                code === 0 ? resolve(true) : resolve(false);
                console.log(`child process exited with code ${code}`);
            });
        })
    }

    private static createOrShowOutputChannel(): vscode.OutputChannel{
        if(this._outputChannel){
            this._outputChannel.show();
            return this._outputChannel;
        }
        this._outputChannel = vscode.window.createOutputChannel('Aldesco Output');
        this._outputChannel.show();
        return this._outputChannel;
    }

    private static async createOrGetOutputFolder(extensionPath: string): Promise<string>{
        const wsFolder = vscode.workspace.workspaceFolders?.[0]; // Get the top level workspace folder
        let outputPath: string;
        if(wsFolder){
            outputPath = path.join(wsFolder.uri.fsPath, 'aldesco-output');
            
            if(fs.existsSync(outputPath)){
                return outputPath;
            }
            
            try {
                await fs.promises.mkdir(outputPath, { recursive: true });
                console.log(`Directory ${outputPath} created`);
                return outputPath;
            } catch (err) {
                console.error('Failed to create output directory:', err);
                return path.join(extensionPath, 'prototype');
            }
        }else{
            return path.join(extensionPath, 'prototype');
        }
    }

}
