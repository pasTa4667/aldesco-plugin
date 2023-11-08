import * as assert from 'assert';
import Prototype from '../../prototype-commands/ptCommands';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test.skip('Get compile file test', () => {
		const path = 'd:/Felix/Programming/AlDesCo_Git/aldesco_spoon_prototype/pattern_pool/playground/FindAllMethods2.java';
		
		const chain = Prototype.getCompiledFromJava(path);
		console.log(chain);

	});

	test.skip('regex test', () => {
		const filename = 'sample';
		const input = 'thisisanexamplenotasample: 0/40andtherforeweneedmoresample: 12/40i';
		const regexNumbers = new RegExp(/\d+\/\d+/, 'g');
		const match = input.match(regexNumbers);

		match?.forEach((n) => console.log(n));

	});

	test.skip('String test', () => {
		const text = 'test string here it begins and then \n something is missing \n stuff!s \n something \n is missing \n more is missing \n something is missing';
		
		const selection = 'something is missing';
		const endLine = 4;
		const textBeforeSelection = text.split('\n').slice(0, endLine + 1).join('\n');
		console.log(textBeforeSelection);

	});

});

