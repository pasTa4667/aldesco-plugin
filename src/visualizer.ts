import * as vscode from 'vscode';
import { join } from 'path';
import { existsSync, readFile } from 'fs';
import { readFileContent } from './prototype-commands/fileUtils';

interface VisualizerData {
    panel?: vscode.WebviewPanel;
    id: number;
    group?: number;
}

/**
 * Manages visualizer webviews
 */
export default class Visualizer {

    private static currentVisualizer: Visualizer | undefined;

    private visualizerData: any;

    private static readonly viewType = 'visualizer';
    private static _panels: VisualizerData[] = [];
    private static _idStart = 1;
    private static _group = 1;

    //to keep track of the last used webview
    private static _activePanel: VisualizerData = { panel: undefined, id: 0 };

    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private readonly _configuration = vscode.workspace.getConfiguration('aldesco-extension');

    //message list to keep track of not acknowledged messages
    private _messageList: { type: string }[] = [];

    public static createOrShow(visualizerData: any, fileName?: string): Promise<Visualizer | undefined> {
        return new Promise<Visualizer>(async (resolve) => {
            const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;
            
            // If we already have a panel, show it.
            // Otherwise, create a new panel.
            if (Visualizer.currentVisualizer) {
                Visualizer.currentVisualizer._panel.reveal(column);
                resolve(Visualizer.currentVisualizer);
            } else {
                Visualizer.currentVisualizer = new Visualizer(visualizerData, column || vscode.ViewColumn.One, undefined, fileName ? fileName : '');         
                await Visualizer.currentVisualizer.wasMessageReceived('Started');
                resolve(Visualizer.currentVisualizer);
            }
        });
    }

    public duplicateActive(visualizerData: any, title: string): Promise<Visualizer | undefined> {
        return new Promise<Visualizer | undefined>(async (res) => {
            const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;
    
            if (Visualizer._activePanel.panel) {
                if (!Visualizer._activePanel.group) {
                    Visualizer._activePanel.group = Visualizer._group++;
                    await this.sendMessageWithAck('VSC:SetGroup', { group: Visualizer._group, join: false});
                }

                Visualizer.currentVisualizer = new Visualizer(visualizerData, column || vscode.ViewColumn.One, Visualizer._group, title);
                await Visualizer.currentVisualizer.wasMessageReceived('Started');
                await Visualizer.currentVisualizer.sendMessageWithAck('VSC:SetGroup', { group: Visualizer._group, join: true });
                
                res(Visualizer.currentVisualizer);
            }
            res(undefined);
        });
    }
    
    private constructor(visualizerData: any, column: vscode.ViewColumn, group?: number, fileName?: string) {
        this.visualizerData = visualizerData;
        const idGenerator = this.idGenerator();
        const id = idGenerator.next().value;
        const title = fileName ? fileName : 'Visualizer ' + id;
        
        // Create and show a new webview panel
        this._panel = vscode.window.createWebviewPanel(Visualizer.viewType, title, column, {
            // Enable javascript in the webview
            enableScripts: true,
            // To stop the webview from closing, when not active
            retainContextWhenHidden: true,
        });
        
        const newPanel = { panel: this._panel, id: id, group: group ? group : undefined };
        Visualizer._panels.push(newPanel);
        Visualizer._activePanel = newPanel;
        
        //to receive an Ack when the visualizer has fully started
        this._messageList.push({ type: 'Started' });
        
        // Set the webview's initial html content 
        this._panel.webview.html = this._getHtmlForWebview();
        
        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        
        this._panel.onDidChangeViewState(() => {
            if (this._panel.active) {
                Visualizer._activePanel.panel = this._panel;
            }
        });

        this._panel.webview.onDidReceiveMessage((event) => {
            this.acknowledgeMessage(event);
        });
        
        console.log("new panel: ", newPanel.id, newPanel.group);
    }
    
    
    
    public sendMessage(type: string, message: any) {
        this._panel.webview.postMessage({ type: type, message: message });
    }
    
    public sendMessageWithAck(type: string, message: any): Promise<boolean> {
        return new Promise<boolean>(async (res) => {
            this._panel.webview.postMessage({ type: type, message: message });
            this._messageList.push({ type: type });

            await this.wasMessageReceived(type) ? res(true) : res(false);
        });
    }

    private wasMessageReceived(type: string, notStarted?: boolean) {
        return new Promise<boolean>(async (res) => {

            //if the vis has not started yet, wait for the started ack
            //should always be the case (just to make sure)
            if(notStarted && this._messageList.some((item) => item.type === 'Started')){
                this.wasMessageReceived('Started', true);
            }

            //we give it 2 seconds until the message times out
            const timeout = 4000;
            const startTime = Date.now();

            //wait until the messageList doesnt contain the message anymore
            while (this._messageList.some((item) => item.type === type)) {
                if (Date.now() - startTime > timeout) {
                    res(false);
                    return;
                }
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
            res(true);
        });
    }

    private acknowledgeMessage(type: string) {
        const index = this._messageList.findIndex((item) => item.type + 'Ack' === type);
        if (index > -1) {
            this._messageList.splice(index, 1);
        }
    }

    private broadcastMessage(type: string, message: any) {
        const senderGroup = Visualizer._activePanel.group;
        Visualizer._panels.forEach((wvdata) => {
            if (wvdata.group === senderGroup) {
                wvdata.panel?.webview.postMessage({ type: type, message: message });
            }
        });
    }

    public changeTitle(newTitle: string) {
        const senderGroup = Visualizer._activePanel.group;
        Visualizer._panels.forEach((wvdata) => {
            if (wvdata.group === senderGroup && newTitle && wvdata.panel) {
                wvdata.panel!.title = newTitle;
            }
        });
    }

    public dispose() {
        Visualizer.currentVisualizer = undefined;

        // Clean up resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private * idGenerator(): Generator<number> {
        while (true) {
            yield Visualizer._idStart++;
        }
    }  

    private _getHtmlForWebview() {
        const { cssPathOnDisk, scriptPathOnDisk, iconPathOnDisk } = this.visualizerData;

        const cssUri = this._panel.webview.asWebviewUri(cssPathOnDisk as vscode.Uri);
        const scriptUri = this._panel.webview.asWebviewUri(scriptPathOnDisk as vscode.Uri);
        const iconUri = this._panel.webview.asWebviewUri(iconPathOnDisk as vscode.Uri);

        const enableDarkMode = this._configuration.get('visualizer.enableDarkMode');
        const colorScheme = enableDarkMode ? 'dark-mode' : 'light-mode';

        return `<!doctype html>
		<html>
		<head>
		<meta charset="utf-8"><title>AST Prototype Visualizer</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="${iconUri}">
		<link rel="stylesheet" href=${cssUri}>
		</head>
		<body class=${colorScheme}>
		<script defer="defer" src="${scriptUri}"></script>
		<script> 
			(function() {
				const vscode = acquireVsCodeApi();	
				window.addEventListener("message", (event) => {
                    const type = event.data.type;
                    //send message from vis to our extension
					vscode.postMessage(type);
				});
			}())
		</script>
		</body>
		</html>`;
    }

    // private _getHtmlForWebviewOld() {
    //     // if we are in dev mode, its a different path as the production mode
    //     const isDevMode = this.context.extensionMode === vscode.ExtensionMode.Development ? true : false;
    //     vscode.window.showInformationMessage("extension Mode: " + isDevMode, "path: " + this.context.extensionPath);

    //     const cssPathOnDisk = vscode.Uri.file(join(this.context.extensionPath, isDevMode ? 'src' : 'out', 'media', 'webview.css'));
    //     const manifest = require(join(this.context.extensionPath, isDevMode ? '' : 'out', 'visualizer', 'dist', 'asset-manifest.json'));

    //     const mainScript = manifest['files']['main.js'];
    //     const icon = manifest['files']['favicon.png'];

    //     const scriptPathOnDisk = vscode.Uri.file(join(this.context.extensionPath, isDevMode ? '' : 'out', 'visualizer', 'dist', mainScript));
    //     const iconPathOnDisk = vscode.Uri.file(join(this.context.extensionPath, isDevMode ? '' : 'out', 'visualizer', 'dist', icon));       
    
    //     const cssUri = this._panel.webview.asWebviewUri(cssPathOnDisk);
    //     const scriptUri = this._panel.webview.asWebviewUri(scriptPathOnDisk);
    //     const iconUri = this._panel.webview.asWebviewUri(iconPathOnDisk);

    //     const enableDarkMode = this._configuration.get('visualizer.enableDarkMode');
    //     const colorScheme = enableDarkMode ? 'dark-mode' : 'light-mode';

    //     return `<!doctype html>
	// 	<html>
	// 	<head>
	// 	<meta charset="utf-8"><title>AST Prototype Visualizer</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="${iconUri}">
	// 	<link rel="stylesheet" href=${cssUri}>
	// 	</head>
	// 	<body class=${colorScheme}>
	// 	<script defer="defer" src="${scriptUri}"></script>
	// 	<script> 
	// 		(function() {
	// 			const vscode = acquireVsCodeApi();	
	// 			window.addEventListener("message", (event) => {
    //                 const type = event.data.type;
    //                 //send message from vis to our extension
	// 				vscode.postMessage(type);
	// 			});
	// 		}())
	// 	</script>
	// 	</body>
	// 	</html>`;
    // }
}
