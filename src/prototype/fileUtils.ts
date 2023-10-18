import * as vscode from 'vscode';
import { join, basename, extname } from 'path';
import { promises, readdirSync, readFileSync, existsSync } from 'fs';
import { platform } from 'os';

/*
Contains various functions which handle file or directory operations for the prototype commands
*/

const configuration = vscode.workspace.getConfiguration('aldesco-extension');

/**
 * Either creates or returns the existing output Folder. 
 * (Will always return a valid Path to a directory)
 */
export async function createOrGetOutputFolder(extensionPath: string): Promise<string> {
    const wsFolder = vscode.workspace.workspaceFolders?.[0];

    if (!wsFolder) {
        vscode.window.showInformationMessage('Output Folder could not be generated: Output Files location: ' + join(extensionPath, 'prototype'));
        return join(extensionPath, 'prototype');
    }

    const outputPath = join(wsFolder.uri.fsPath, 'aldesco-output');

    try {
        await promises.mkdir(outputPath, { recursive: true });
        return outputPath;
    } catch (err) {
        vscode.window.showInformationMessage('Output Folder could not be generated: Output Files location: ', join(extensionPath, 'prototype'));
        return join(extensionPath, 'prototype');
    }
}

/**
 * Returns the correct compile command depending on building tool in [0]
 * and the correct argument in [1]. 
 * For example:
 * For a gradlew Project it will return
 * ['gradlew', 'compileJava']
 */
export function getCompileCommand(wsFolder: vscode.WorkspaceFolder): string[]{
    const folder = readdirSync(wsFolder.uri.fsPath);
    const command: string[] = [];
    if (folder.includes('gradlew')) {
        command[0] = 'gradlew';
        command[1] = 'compileJava';
        return command;
    }

    if (folder.includes('build.gradle')) {
        command[0] = 'gradle';
        command[1] = 'compileJava';
        return command;
    }

    if (folder.includes('pom.xml')) {
        command[0] = 'mvn';
        command[1] = 'compile';
        return command;
    }
    return [];
}

/**
 * Searches for a .class file in the build folder from a .java file name in the src folder
 */
export function getCompiledFromJava(toBeSearchedPath: string): string {
    const wsFolder = vscode.workspace.workspaceFolders?.[0];
    const projectDirPath = wsFolder!.uri.fsPath;

    const projectBuildPath = getBuildPath(projectDirPath);

    if (!projectBuildPath) {
        return '';
    }

    const javaFileContents = readFileSync(toBeSearchedPath, 'utf8');

    // Determine the Java file name without the extension
    const javaFileName = basename(toBeSearchedPath, extname(toBeSearchedPath));

    // Extract the package declaration from the Java file
    const packageDeclaration = javaFileContents.match(/package\s+([\w.]+)\s*;/);

    if (!packageDeclaration) {
        return join(projectBuildPath, `${javaFileName}.class`);
    }

    const packageName = packageDeclaration[1];

    // Construct the package directory path based on the package name
    const packagePath = packageName.replace(/\./g, '/');

    // Construct the path of the compiled .class file
    const compiledClassFilePath = join(projectBuildPath, packagePath, `${javaFileName}.class`);

    // Check if the compiled .class file exists
    if (!existsSync(compiledClassFilePath)) {
        vscode.window.showWarningMessage('Compiled file could not be found!');
        return '';
    }

    return compiledClassFilePath;
}

/**
 * Returns the build path of the current Project if it exists 
 */
export function getBuildPath(projectDirectory: string): string {
    const givenBuildPath = configuration.get('prototype.sourceSetBuildLocation') as string;

    if (givenBuildPath && existsSync(givenBuildPath)) {
        return givenBuildPath;
    }

    const gradleBuildPath = join(projectDirectory, 'build', 'classes', 'java', 'main');
    const mavenBuildPath = join(projectDirectory, 'target', 'classes');

    // Check if Gradle build path exists
    if (existsSync(gradleBuildPath)) {
        return gradleBuildPath;
    }

    // Check if Maven build path exists
    if (existsSync(mavenBuildPath)) {
        return mavenBuildPath;
    }
    return '';
}

/**
 * Returns the prefix based on the platform
 */
export function getPrefix(){
    return platform() === 'win32' ? '' : './';
}


/**
 *  Opens a file in a ViewColumn. (default ViewColumn.One) 
 */
export function openFile(filePath: string, viewColumn?: vscode.ViewColumn){
    vscode.workspace.openTextDocument(filePath).then((document) => {
        vscode.window.showTextDocument(document, viewColumn ? viewColumn : vscode.ViewColumn.One);
    }, (error) => {
        vscode.window.showErrorMessage(`Unable to open file: ${error.message}`);
    });
}