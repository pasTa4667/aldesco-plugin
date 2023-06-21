import { spawn } from "child_process";
import * as path from 'path';
import * as vscode from 'vscode';

export default class Prototype {

    private static readonly _prototypePath = 'prototype/ast-prototype-1.0.0.jar';
    private static readonly _configuration = vscode.workspace.getConfiguration('aldesco-extension');
    private static readonly _aldescoProjectDir = this._configuration.get('prototype.aldescoProjectDirectory') as string;
    private static _output: vscode.OutputChannel;

    public static visualizeSpoonAST(extensionPath: string, file: string, startLine?: number): Promise<boolean>{
        return new Promise((resolve) => {
            const args = ['--file', file];
            const prototypeJarLocation = path.join(this._aldescoProjectDir, 'build', 'libs', 'ast-prototype-1.0.0.jar');
            
            if(startLine){
                args.push('--line');
                args.push(startLine.toString());
            }
            
            const childProcess = spawn('java', ['-jar', prototypeJarLocation, ...args], { cwd: this._aldescoProjectDir });
            //const childProcess = spawn('java', ['-jar', this._prototypePath, ...args], { cwd: extensionPath });

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
            console.log('compiling: ', file);
            const outputDir = path.join(extensionPath, 'prototype', 'chains');
           
            const childProcess = spawn('javac', ['-d', outputDir, file]);

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
        return new Promise<boolean>((resolve) => {
            const prototypePath = path.join(extensionPath, 'prototype', 'ast-prototype-1.0.0.jar');
            let outputPath;
            const currentWorkspaceFolder = vscode.workspace.workspaceFolders?.[0]; // Get the top level workspace folder
            //if workspace folder exists use it as ouput location
            if (currentWorkspaceFolder) {
                outputPath = path.join(currentWorkspaceFolder.uri.fsPath, 'output-result.json');
            } else {
                outputPath = path.join('prototype', 'output-result.json');
            }
            console.log(prototypePath);
    
            const args = [];
    
            args.push('--chain');
            args.push(chainPath);
            args.push('--input');
            args.push(folderPath);
            args.push('--output');
            args.push(outputPath);

            args.forEach((a) => console.log(a));

            const childProcess = spawn('java', ['-jar', prototypePath, ...args], { cwd: extensionPath });

            const output = this.createOrShowOuptut();
  
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

    private static createOrShowOuptut(): vscode.OutputChannel{
        if(this._output){
            this._output.show();
            return this._output;
        }
        this._output = vscode.window.createOutputChannel('Aldesco Output');
        this._output.show();
        return this._output;
    }

}
