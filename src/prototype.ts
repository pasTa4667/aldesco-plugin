import { spawn } from "child_process";
import { format } from "date-fns";
import * as fileUtils from "./prototype/ptFileUtils";
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as os from 'os';

export default class Prototype {

    private static readonly _prototypePath = 'prototype/ast-prototype-1.0.0.jar';
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
            const outputFolder = await fileUtils.createOrGetOutputFolder(extensionPath);
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

    public static compileAllFiles(filePath: string): Promise<string>{
        return new Promise<string>((resolve) => {
            const wsFolder = vscode.workspace.workspaceFolders?.[0]; // Get the top level workspace folder

            if(!wsFolder){
                vscode.window.showInformationMessage('No Project found to compile file in!');
                return;
            }

            const pre = os.platform() === 'win32' ? '' : './';
            const command = fileUtils.getCommand(wsFolder);

            if(!command){
                vscode.window.showErrorMessage('Build tool not supported! Only gradle or maven projects can be build.');
                return;
            }

            const childProcess = spawn(`${pre}${command[0]}`, [command[1]], { cwd: wsFolder.uri.fsPath, shell: true });
            
            // Handle events and output from the child process
            childProcess.stdout.on('data', (data) => {
                console.log(`stdout: ${data}`);
                //vscode.window.showInformationMessage(`Compiled successfully: ${data}`);
            });

            childProcess.stderr.on('data', (data) => {
                console.log(`stderr: ${data}`);
                vscode.window.showErrorMessage(`File couldn't be compiled:\n ${data}`);
                resolve('');
            });

            childProcess.on('close', (code) => {
                code === 0 ? resolve(fileUtils.getCompiledFromJava(filePath)) : resolve('');
                console.log(`child process exited with code ${code}`);
            });

        });
    }

    public static compileSingleFile(extensionPath: string, filePath: string): Promise<string>{
        return new Promise<string>((resolve) => {

            const wsFolder = vscode.workspace.workspaceFolders?.[0]; // Get the top level workspace folder
            const projectDirPath = wsFolder!.uri.fsPath;

            if(!projectDirPath){
                vscode.window.showWarningMessage('No Project found to compile file in!');
                return;
            }

            const buildPath = fileUtils.getBuildPath(projectDirPath);
            const prototypeJarPath = path.join(extensionPath, 'prototype', 'ast-prototype-1.0.0.jar'); 

            //javac adds packages to the target directory for use
            const args = ['-cp', `${buildPath};${prototypeJarPath}`, '-d', buildPath, filePath];

            const childProcess = spawn('javac', args, { cwd: projectDirPath });
    
            // Handle events and output from the child process
            childProcess.stdout.on('data', (data) => {
                //console.log(`stdout: ${data}`);
            });
    
            childProcess.stderr.on('data', (data) => {
                //console.log(`stderr: ${data}`);
                vscode.window.showErrorMessage(`File couldn't be compiled:\n Not all imports are supported in this command, try compile all`);
                resolve('');
            });
    
            childProcess.on('close', (code) => {
                code === 0 ? resolve(fileUtils.getCompiledFromJava(filePath)) : resolve('');
                console.log(`child process exited with code ${code}`);
            });
        })
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
            const outputFolder = await fileUtils.createOrGetOutputFolder(extensionPath);

            const args = ['--chain', chainPath, '--input', folderPath, '--output', outputName]; 

            const childProcess = spawn('java', ['-jar', absPrototypePath, ...args], { cwd: outputFolder });

            const output = this.createOrShowOutputChannel();
  
            // Handle events and output from the child process
            childProcess.stdout.on('data', (data) => {
                //const parsed = (data.toString() as string).replace(/\|\/g, '->');
                const parsed = (data.toString() as string);
                output.append(parsed);
            });
    
            childProcess.stderr.on('data', (data) => {
                console.error(`stderr: ${data}`);
                vscode.window.showErrorMessage(`Error while trying to match Folder: ${data}`);
                resolve(false);
            });
    
            childProcess.on('close', (code) => {
                code === 0 ? resolve(true) : resolve(false);
                console.log(`child process exited with code ${code}`);
            });

        })
    }

    //returns the outupt channel where the matching results are displayed
    private static createOrShowOutputChannel(): vscode.OutputChannel{
        if(this._outputChannel){
            this._outputChannel.show();
            return this._outputChannel;
        }
        this._outputChannel = vscode.window.createOutputChannel('Aldesco Output');
        this._outputChannel.show();
        return this._outputChannel;
    }


    //searches for a .class file in the build folder from a .java file name in the src folder
    public static getCompiledFromJava(notCompiledPath: string): string {
        const wsFolder = vscode.workspace.workspaceFolders?.[0];
        const projectDirPath = wsFolder!.uri.fsPath;

        const projectBuildPath = fileUtils.getBuildPath(projectDirPath);

        if(!projectBuildPath){
            vscode.window.showInformationMessage('The build folder doesn\'t exist or could not be found! Check the documentation for more Info');
            return '';
        }

        const javaFileContents = fs.readFileSync(notCompiledPath, 'utf8');

        // Determine the Java file name without the extension
        const javaFileName = path.basename(notCompiledPath, path.extname(notCompiledPath));
        
        // Extract the package declaration from the Java file
        const packageDeclaration = javaFileContents.match(/package\s+([\w.]+)\s*;/);

        if(!packageDeclaration){
            return path.join(projectBuildPath, `${javaFileName}.class`);
        }

        const packageName = packageDeclaration[1];

        // Construct the package directory path based on the package name
        const packagePath = packageName.replace(/\./g, '/');

        // Construct the path of the compiled .class file
        const compiledClassFilePath = path.join(projectBuildPath, packagePath, `${javaFileName}.class`);

        // Check if the compiled .class file exists
        if (!fs.existsSync(compiledClassFilePath)) {
            vscode.window.showWarningMessage('Compiled file could not be found!');
            return '';
        }
 
        return compiledClassFilePath;
    }


    private static spawnChildProcess(command: string, cwd: string, shell: boolean, ...args: string[]){
        const childProcess = spawn(command, args, {cwd: cwd, shell: shell});

        // Handle events and output from the child process
        childProcess.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });

        childProcess.stderr.on('data', (data) => {
            console.log(`stderr: ${data}`);
        });

        childProcess.on('close', (code) => {
            //code === 0 ? resolve(true) : resolve(false);
            console.log(`child process exited with code ${code}`);
        });
    }

}
