## How to work with this extension:

1. After cloning run `npm i`. This repository contains a submodule, keep that in mind when cloning.
2. Change to the visualizer directory, run `npm ci` and `npm run build` afterward.
3. Press F5 select VS Extension Developement (preview).
4. In the new VSC Window open the VSC `Command Palette` (cntrl + shift + p) and type Visualizer to view all commands.
5. Make sure to set the right paths in the Extension [Settings](#settings).

# aldesco-extension README

## Features

All features can be accessed via the `Command Palette` (Ctrl + Shift + P). Make sure to check the [Settings](#settings) to use all commands properly.

> When running commands which generate output a `aldesco-output` Folder will be created at the top level of the currently opened Project Directory.

**1. Open Visualizer**: Opens a new or shows the current Visualizer Webview without a vis file.

**2. Open Most Recent**: Opens the most recently created or changed vis file inside a Visualizer Webview from the `visualizer-logs` folder.

**3. Duplicate Visualizer**: Duplicates the last used Visualizer Webview and syncs actions from the other Visualizer and vice versa. This command will only appear once a Visualizer Webview has been created.

**4. Open File in Visualizer**: A vis file can be either right-clicked and opened inside the Visualizer Webview or with a vis file opened and focused in the editor, the command can be run in the Command Palette.

**5. Visualize Spoon AST**: Open a file to be visualized and either run the command in the `Command Palette` to visualize the entire file or select an element and right-click it, be sure to only select the element you want to visualize and not any additional whitespaces. An element can be a method, an entire class, an assignment or just a data type.

**6. Set a Chain and Match Folder**: A Chain can be set by either right-clicking a CLASS File in the VS Code Explorer or by running the command in the `Command Palette` and choosing a CLASS File in the File Explorer. Additionally, a JAVA File can be right clicked automatically compiled and set as Chain or set as Chain without comiling. The Chain can also be set by directly by providing the absolute path of a Chain inside the aldesco-extension [Settings](#settings). To view the current Chain, run the **Show current Chain** command in the `Command Palette`. Lastly, right-click or select a folder with the **Match Folder with Chain** command and match the folder with the currently selected Chain.

![Set Chain and Match Folder](media/match_feature.mp4)

## Command List
The most important commands have been described above. Here is a list of all the commands available.

1. **AlDeSCo: Open Visualizer**
2. **AlDeSCo: Open Log File in Visualizer**
3. **AlDeSCo: Open Most Recent Log File in Visualizer**
4. **AlDeSCo: Visualize Spoon AST**
5. **AlDeSCo: Set as Chain**
6. **AlDeSCo: Compile and set as Chain**
7. **AlDeSCo: Show current Chain**
8. **AlDeSCo: Match Folder with Chain**
9. **AlDeSCo: Duplicate Visualizer**

<Requirements>

## Settings

Most of the time setting the paths manually is not necessary and can be done through commands or are set automatically by the extension.

> A reload is required after changing settings! 

- `aldesco-extension.prototype.sourceSetBuildLocation`: Sets the location of the Source Set within the Build Folder (absolute Path). For example, for gradle the location path should look like this 'D:\User\MyGradleProject\build\classes\java\main' or for maven 'D:\User\MyMavenProject\target\classes'. You only have to set this if you don't use the standard maven or gradle build or the extension can not find your build path automatically (Error: The build folder doesn't exist or could not be found!). 
- `aldesco-extension.prototype.chainLocation`: Sets the location of the Chain used for matching (absolute path). This does not have to be set manually and can be accessed via commands.


## Known Issues

Sometimes the Visualizer does not load properly.
Fix: Click Hide/Show view or reload the same file.

## Release Notes

Users appreciate release notes as you update your extension.

### 1.0.0

Initial release of ...
