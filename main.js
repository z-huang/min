var app = require('app'); // Module to control application life.
var BrowserWindow = require('browser-window'); // Module to create native browser window.
var electronScreen = null; //setup in app.ready

var mainWindow = null;

function sendIPCToWindow(window, action, data) {
	if (!window) {
		window = createWindow();
	}
	window.webContents.send(action, data || {});
}

function createWindow() {
	var size = electronScreen.getPrimaryDisplay().workAreaSize;
	mainWindow = new BrowserWindow({
		width: size.width,
		height: size.height,
		'min-width': 320,
		'min-height': 500,
		'title-bar-style': 'hidden-inset',
	});

	// and load the index.html of the app.
	mainWindow.loadUrl('file://' + __dirname + '/index.html');

	// Emitted when the window is closed.
	mainWindow.on('closed', function () {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		mainWindow = null;
	});

	/* handle pdf downloads - ipc recieved in fileDownloadManager.js */

	mainWindow.webContents.session.on("will-download", function (event, item, webContents) {
		if (item.getMimeType() == "application/pdf") {
			event.preventDefault();
			sendIPCToWindow(mainWindow, "openPDF", {
				url: item.getUrl(),
				event: event,
				item: item,
				webContents: webContents
			});
		}
		return true;
	});


	return mainWindow;
}

function createAppMenu() {
	// create the menu. based on example from http://electron.atom.io/docs/v0.34.0/api/menu/

	var Menu = require('menu');
	var MenuItem = require('menu-item');


	var template = [
		{
			label: 'File',
			submenu: [
				{
					label: 'New Tab',
					accelerator: 'CmdOrCtrl+t',
					click: function (item, window) {
						sendIPCToWindow(window, "addTab");
					}
      },
				{
					label: 'New Private Tab',
					accelerator: 'shift+CmdOrCtrl+t',
					click: function (item, window) {
						sendIPCToWindow(window, "addPrivateTab");
					}
      },
				{
					type: "separator"
      },
				{
					label: 'Print',
					accelerator: 'CmdOrCtrl+p',
					click: function (item, window) {
						sendIPCToWindow(window, "print");
					}
      },
    ]
  },
		{
			label: 'Edit',
			submenu: [
				{
					label: 'Undo',
					accelerator: 'CmdOrCtrl+Z',
					role: 'undo'
      },
				{
					label: 'Redo',
					accelerator: 'Shift+CmdOrCtrl+Z',
					role: 'redo'
      },
				{
					type: 'separator'
      },
				{
					label: 'Cut',
					accelerator: 'CmdOrCtrl+X',
					role: 'cut'
      },
				{
					label: 'Copy',
					accelerator: 'CmdOrCtrl+C',
					role: 'copy'
      },
				{
					label: 'Paste',
					accelerator: 'CmdOrCtrl+V',
					role: 'paste'
      },
				{
					label: 'Select All',
					accelerator: 'CmdOrCtrl+A',
					role: 'selectall'
      },
    ]
  },
	/* these items are added by os x */
		{
			label: 'View',
			submenu: [
				{
					label: 'Zoom in',
					accelerator: 'Command+=',
					click: function (item, window) {
						sendIPCToWindow(window, "zoomIn");
					}
      },
				{
					label: 'Zoom out',
					accelerator: 'CmdOrCtrl+-',
					click: function (item, window) {
						sendIPCToWindow(window, "zoomOut");
					}
      },
				{
					label: 'Actual size',
					accelerator: 'CmdOrCtrl+0',
					click: function (item, window) {
						sendIPCToWindow(window, "zoomReset");
					}
      },
		]
  },
		{
			label: 'Developer',
			submenu: [
				{
					label: 'Reload',
					accelerator: 'CmdOrCtrl+R',
					click: function (item, focusedWindow) {
						if (focusedWindow)
							focusedWindow.reload();
					}
      },
				{
					label: 'Inspect browser',
					click: function (item, focusedWindow) {
						if (focusedWindow)
							focusedWindow.toggleDevTools();
					}
      },
				{
					type: "separator"
			},
				{
					label: 'Inspect page',
					accelerator: 'Cmd+Alt+I',
					click: function (item, window) {
						sendIPCToWindow(window, "inspectPage");
					}
      },
    ]
  },
		{
			label: 'Window',
			role: 'window',
			submenu: [
				{
					label: 'Minimize',
					accelerator: 'CmdOrCtrl+M',
					role: 'minimize'
      },
				{
					label: 'Close',
					accelerator: 'CmdOrCtrl+W',
					role: 'close'
      },
    ]
  },
		{
			label: 'Help',
			role: 'help',
			submenu: [
				{
					label: 'Learn More',
					click: function () {
						require('shell').openExternal('http://github.com/palmerAl/browser')
					}
      },
    ]
  },
];

	if (process.platform == 'darwin') {
		var name = app.getName();
		template.unshift({
			label: name,
			submenu: [
				{
					label: 'About ' + name,
					role: 'about'
      },
				{
					type: 'separator'
      },
				{
					label: 'Services',
					role: 'services',
					submenu: []
      },
				{
					type: 'separator'
      },
				{
					label: 'Hide ' + name,
					accelerator: 'Command+H',
					role: 'hide'
      },
				{
					label: 'Hide Others',
					accelerator: 'Command+Shift+H',
					role: 'hideothers'
      },
				{
					label: 'Show All',
					role: 'unhide'
      },
				{
					type: 'separator'
      },
				{
					label: 'Quit',
					accelerator: 'Command+Q',
					click: function () {
						app.quit();
					}
      },
    ]
		});
		// Window menu.
		template[3].submenu.push({
			type: 'separator'
		}, {
			label: 'Bring All to Front',
			role: 'front'
		});
	}

	var menu = new Menu();

	menu = Menu.buildFromTemplate(template);
	Menu.setApplicationMenu(menu);

}

// Quit when all windows are closed.
app.on('window-all-closed', function () {
	// On OS X it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if (process.platform != 'darwin') {
		app.quit();
	}
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', function () {
	// Create the browser window.
	electronScreen = require('screen'); //this module must be loaded after the app is ready

	createWindow();

	// Open the DevTools.
	//mainWindow.openDevTools();

	createAppMenu();

});