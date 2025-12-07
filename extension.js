const vscode = require('vscode');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  const command = vscode.commands.registerCommand('luaMerger.helloWorld', () => {
    vscode.window.showInformationMessage('Hello World from Lua Merger!');
  });

  context.subscriptions.push(command);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
