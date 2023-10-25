import * as vscode from 'vscode';

let statusBarItem: vscode.StatusBarItem | null;
let statusBarErrorColor = new vscode.ThemeColor('statusBarItem.errorBackground');

export function initialize() {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
    statusBarItem.text = 'Waiting';
    statusBarItem.tooltip = 'Pattern Matching Results';
    statusBarItem.command = {
        title: '',
        command: 'aldesco-extension.stopMatchLoop'
    }
    statusBarItem.show();
}

export function setMatchedState(text?: string) {
    if(statusBarItem){
        statusBarItem.text = text ? text : 'Matched';
        statusBarItem.backgroundColor = undefined;
    }
}

export function setToolTip(text: string | vscode.MarkdownString){
    if(statusBarItem){
        statusBarItem.tooltip = text;
    }
}

export function setFailedState(text?: string) {
    if(statusBarItem){
        statusBarItem.backgroundColor = statusBarErrorColor;
        statusBarItem.text = text ? text : 'Failed';
    }
}

export function setLoadingState() {
    if(statusBarItem){
        statusBarItem.text = '$(loading~spin) Matching';
    }
}

export function dispose(){
    if(statusBarItem){
        statusBarItem.dispose();
    }
}

export function isActive(){
    return statusBarItem ? true : false;
}