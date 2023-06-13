import { spawn } from "child_process";
import path = require("path");
import * as vscode from 'vscode';

export default class Prototype {

    private static readonly _prototypePath = 'prototype/ast-prototype-1.0.0.jar';
    private static readonly _configuration = vscode.workspace.getConfiguration('aldesco-extension');
    private static readonly _aldescoProjectDir = this._configuration.get('prototype.aldescoProjectDirectory') as string;

    public static visualizeSpoonAST(extensionPath: string, file: string, startLine?: number): Promise<boolean>{
        return new Promise((resolve) => {
            const args = ['--file', file];
            const prototypeJarLocation = path.join(this._aldescoProjectDir, 'build', 'libs', 'ast-prototype-1.0.0.jar');
            
            if(startLine){
                args.push('--line');
                args.push(startLine.toString());
            }
            
            const childProcess = spawn('java', ['-jar', prototypeJarLocation, ...args], { cwd: this._aldescoProjectDir });
    
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

    public static execute(extensionPath: string, ...args: string[]) {
        const prototype = path.join(extensionPath, 'prototype', 'ast-prototype-1.0.0.jar');
        const testFolder = path.join(extensionPath, 'prototype', 'files', '12');
        const chain = path.join(extensionPath, 'prototype', 'chains', 'FindAllMethods.class');

        const outputLocation = this._configuration.get('prototype.outputLocation') as string;
        const chainLocation = this._configuration.get('prototype.chainLocation') as string;
        let inputLocation = this._configuration.get('prototype.inputLocation') as string;
        inputLocation = inputLocation;

        console.log(inputLocation);

        args.push('--chain');
        args.push(chainLocation);
        args.push('--input');
        args.push(inputLocation);
        args.push('--output');
        args.push(outputLocation);

        args.forEach((value) => {
            console.log(value);
        })

        const childProcess = spawn('java', ['-jar', this._prototypePath, ...args], { cwd: extensionPath });

        // Handle events and output from the child process
        childProcess.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });

        childProcess.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });

        childProcess.on('close', (code) => {
            console.log(`child process exited with code ${code}`);
        });
    }
}
