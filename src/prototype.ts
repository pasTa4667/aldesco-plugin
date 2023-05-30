import { spawn } from "child_process";
import path = require("path");
import * as vscode from 'vscode';

export default class Prototype {

    private readonly _extensionPath: string;
    private readonly _prototypePath = 'prototype/ast-prototype-1.0.0.jar';
    private readonly _configuration = vscode.workspace.getConfiguration('aldesco-extension');

    constructor(extensionPath: string) {
        this._extensionPath = extensionPath;
    }

    public execute(...args: string[]) {
        const prototype = path.join(this._extensionPath, 'prototype', 'ast-prototype-1.0.0.jar');
        const testFolder = path.join(this._extensionPath, 'prototype', 'files', '12');
        const chain = path.join(this._extensionPath, 'prototype', 'chains', 'FindAllMethods.class');

        const outputLocation = this._configuration.get('prototype.outputLocation') as string;
        const chainLocation = this._configuration.get('prototype.chainLocation') as string;
        let inputLocation = this._configuration.get('prototype.inputLocation') as string;
        inputLocation = '\"' + inputLocation + '\"';

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

        const childProcess = spawn('java', ['-jar', this._prototypePath, ...args], { cwd: this._extensionPath });

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
