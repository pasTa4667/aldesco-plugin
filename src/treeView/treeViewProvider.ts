import * as vscode from 'vscode';
import { readFile } from 'fs';
import { basename } from 'path';
import * as resultAnalyzer from './resultAnalyzer';

type Snippet = {
  propability: number;
  weight: number;
  name: string;
  comment: string;
  file: string;
  range: { startLine: number, endLine: number };
  labels: string[];
}

type Result = {
  snippets: Snippet[];
  name: string;
}

enum Icon {
  json = 'json',
  folder = 'folder',
  fileCode = 'file-code',
  symbolMethod = 'symbol-method',
}

export class TreeViewProvider implements vscode.TreeDataProvider<ResultContainer> {
  constructor(private rootContainer: ResultContainer) {}

  getTreeItem(element: ResultContainer): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ResultContainer): Promise<ResultContainer[]> {
    if (!this.rootContainer) {
      vscode.window.showInformationMessage('Not able to locate result json');
      return Promise.resolve([]);
    }
    if (element) {
      return Promise.resolve(element.results);
    } else {
      return Promise.resolve([this.rootContainer]);
    }
  }

}

export class ResultContainer extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly results: ResultContainer[],
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    private readonly icon: Icon,
    private name?: string,
    public snippets?: Snippet[],
    private filePath?: string,
    private methodName?: string,
    public command?: vscode.Command,
    public readonly isFile?: boolean, //for analysing the results later on

  ) {
    if (label === '') {
      label = 'unknown';
    }
    super(label, collapsibleState);
    if(filePath){
      this.addCommand();
    }
    
    this.iconPath = new vscode.ThemeIcon(this.icon);
    
    if(this.icon == Icon.fileCode){
      this.isFile = true;
    }
    
  }

  //Command for opening the file
  private addCommand(){
    this.command = {
      title: '',
      command: 'vscode.open',
      arguments: [vscode.Uri.file(this.filePath!), {selection: this.generateSelectionFromRange()}],
    }
  }

  private generateSelectionFromRange(){
    const startLine = this.snippets![0].range.startLine - 1;
    const endLine = this.snippets![0].range.endLine;

    return  { start: {line: startLine, character: 0}, end: {line: endLine, character: 0}}
  }
}

/**
 * Adds the Output Tree View to the explorer
 */
export function initiateTreeView(jsonFilePath: string){
  return new Promise<ResultContainer> ((res, rej) => {
    let result: Result[] = [];
    readFile(jsonFilePath, 'utf8', (err, data) => {
      try {
        result = JSON.parse(data);
        if(result){
          const folderName = basename(jsonFilePath);
          const root = sortResultIntoTree(result, folderName);
  
          if(root.results.length != 0){
            vscode.window.createTreeView('aldesco-extension.matchTreeView', {
              treeDataProvider: new TreeViewProvider(root)
            });
            res(root);
          }else{
            rej(undefined);
          }
        }
      } catch (error) {
        console.error('Error parsing the JSON data', error);
        vscode.window.showErrorMessage('File could not be read or parsed');
        rej(undefined);
      }
    });
  })
}


/**
 * Returns the analyzed results of the current Match Tree, if one exists.
 * File name as key and number of matches as value.
 */
export function analyzeMatchResults(rootContainer: ResultContainer): Map<string, number> | undefined{
  if(rootContainer){
    return resultAnalyzer.analyzeMatchResults(rootContainer);
  }
}


function sortResultIntoTree(results: Result[], root: string) {
  const rootContainer: ResultContainer = new ResultContainer(root, [], vscode.TreeItemCollapsibleState.Collapsed, Icon.json);

  results.forEach((result) => {
    const resultPath: string[] = result.snippets[0].file.split('\\');
    const resultFileName = resultPath.pop() || '';

    // Initialize the current container as the root container
    let currentContainer: ResultContainer = rootContainer;

    const addContainer = (fileOrDirName: string, file?: boolean) => {
      let matchingContainer = currentContainer.results.find((cont) => cont.label === fileOrDirName);

      if (!matchingContainer) {
        // If the container doesn't exist, create a new one and add it to the current container
        matchingContainer = new ResultContainer(fileOrDirName, [], vscode.TreeItemCollapsibleState.Collapsed, file ? Icon.fileCode : Icon.folder);
        currentContainer.results.push(matchingContainer);
      }

      // Update the current container for the next iteration
      currentContainer = matchingContainer;
    }

    resultPath.forEach((dir) => {
      addContainer(dir);
    });

    addContainer(resultFileName, true);
    // Add the result to the current container's results
    const { methodName, filePath } = parseLocation(result.name);
    const endResult = new ResultContainer(methodName ? methodName : '', [], vscode.TreeItemCollapsibleState.None, Icon.symbolMethod, result.name, result.snippets, filePath, methodName);
    currentContainer.results.push(endResult);

  });

  return rootContainer;
}

function parseLocation(location: string) {
  const pattern = /(\w+\(.*\)) location: \(([^)]+)\)/;

  // Use the pattern to match against the input string
  const matches = location.match(pattern);

  if (matches && matches.length === 3) {
    // matches[1] contains the method, matches[2] contains the path
    const method = matches[1];
    const path = matches[2];

    //remove the line becuase not compatible with vscode
    const splitPath = path.split(':');
    splitPath.pop();

    return { methodName: method, filePath: splitPath.join(':') };
  }

  return {};
}