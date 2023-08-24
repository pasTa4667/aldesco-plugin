import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class TreeViewProvider implements vscode.TreeDataProvider<Content> {
  constructor(private workspaceRoot: string) {}

  getTreeItem(element: Content): vscode.TreeItem {
    return element;
  }

  getChildren(element?: Content): Promise<Content[]> {
    if (!this.workspaceRoot) {
      vscode.window.showInformationMessage('No Root Folder found');
      return Promise.resolve([]);
    }

    if (element) {
      return Promise.resolve(
        this.getElementContent(path.join(this.workspaceRoot, 'aldesco-output', element.name))
      );
    } else {
      const aldescoOutputPath = path.join(this.workspaceRoot, 'aldesco-output');
      if (this.pathExists(aldescoOutputPath)) {
        return Promise.resolve(this.getElementContent(aldescoOutputPath));
      } else {
        vscode.window.showInformationMessage('Workspace has no aldesco-output folder');
        return Promise.resolve([]);
      }
    }
  }

  /**
   * Given the path to an element, get all its children elements
   */
  private getElementContent(elementPath: string): Content[] {
    const content: Content[] = [];

    if (!this.pathExists(elementPath)) {
      return content;
    }

    if (fs.statSync(elementPath).isDirectory()){
      const folder = fs.readdirSync(elementPath);
      folder.forEach(child => {
        const childPath = path.join(elementPath, child);
        if(fs.statSync(childPath).isDirectory()){
          content.push(new Content(child, vscode.TreeItemCollapsibleState.Collapsed));
        }else{
          content.push(new Content(child, vscode.TreeItemCollapsibleState.None));
        }
      });
    }else{
      content.push(new Content(path.basename(elementPath), vscode.TreeItemCollapsibleState.None));
    }

    return content;
  }

  private pathExists(p: string): boolean {
    try {
      fs.accessSync(p);
    } catch (err) {
      return false;
    }
    return true;
  }
}

class Content extends vscode.TreeItem {
  constructor(
    public readonly name: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    super(name, collapsibleState);
  }
}


/**
 * Adds the Output Tree View to the explorer
 */
export function initiateTreeView(){
  const rootPath =
      vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
        ? vscode.workspace.workspaceFolders[0].uri.fsPath
        : undefined;

  if(rootPath){
    vscode.window.createTreeView('aldesco-extension.outputView', {
    treeDataProvider: new TreeViewProvider(rootPath!)
  });
  }
}