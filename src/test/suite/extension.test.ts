import * as assert from 'assert';
import Prototype from '../../prototype';
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Get compile file test', () => {
		const path = 'd:/Felix/Programming/AlDesCo_Git/aldesco_spoon_prototype/pattern_pool/playground/FindAllMethods2.java';
		
		const chain = Prototype.getCompiledFromJava(path);
		console.log(chain)
	});
});
