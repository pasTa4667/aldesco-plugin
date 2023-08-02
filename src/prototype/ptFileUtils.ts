import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/*
Contains various functions which handle file or directory operations for the prototype commands
*/

const configuration = vscode.workspace.getConfiguration('aldesco-extension');

/**
 * Either creates or returns the existing output Folder
 */
export function createOrGetOutputFolder(extensionPath: string): Promise <string> {
    return new Promise<string>(async (resolve) => {
        const wsFolder = vscode.workspace.workspaceFolders?.[0]; // Get the top level workspace folder
        let outputPath: string;
        if (wsFolder) {
            outputPath = path.join(wsFolder.uri.fsPath, 'aldesco-output');

            if (fs.existsSync(outputPath)) {
                resolve(outputPath);
            }

            try {
                await fs.promises.mkdir(outputPath, { recursive: true });
                console.log(`Directory ${outputPath} created`);
                resolve(outputPath);
            } catch (err) {
                console.error('Failed to create output directory:', err);
                resolve(path.join(extensionPath, 'prototype'));
            }
        } else {
            resolve(path.join(extensionPath, 'prototype'));
        }
    })
}

/**
 * Returns the correct command depending on building tool in [0]
 * and the correct argument in [1]. 
 * For example:
 * For a gradlew Project it will return
 * ['gradlew', 'compileJava']
 */
export function getCommand(wsFolder: vscode.WorkspaceFolder): string[]{
    const folder = fs.readdirSync(wsFolder.uri.fsPath);
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
        vscode.window.showInformationMessage('The build folder doesn\'t exist or could not be found! Check the documentation for more Info');
        return '';
    }

    const javaFileContents = fs.readFileSync(toBeSearchedPath, 'utf8');

    // Determine the Java file name without the extension
    const javaFileName = path.basename(toBeSearchedPath, path.extname(toBeSearchedPath));

    // Extract the package declaration from the Java file
    const packageDeclaration = javaFileContents.match(/package\s+([\w.]+)\s*;/);

    if (!packageDeclaration) {
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

/**
 * Returns the build path of the current Project if it exists 
 */
export function getBuildPath(projectDirectory: string): string {
    const givenBuildPath = configuration.get('prototype.sourceSetBuildLocation') as string;

    if (givenBuildPath && fs.existsSync(givenBuildPath)) {
        return givenBuildPath;
    }

    const gradleBuildPath = path.join(projectDirectory, 'build', 'classes', 'java', 'main');
    const mavenBuildPath = path.join(projectDirectory, 'target', 'classes');

    // Check if Gradle build path exists
    if (fs.existsSync(gradleBuildPath)) {
        return gradleBuildPath;
    }

    // Check if Maven build path exists
    if (fs.existsSync(mavenBuildPath)) {
        return mavenBuildPath;
    }
    return '';
}